from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.authentication import TokenAuthentication, SessionAuthentication
from django.db.models import Count, Sum
from django.db import transaction
from .models import SupplyCategory, Supply, EvacuationCenter, Equipment, Volunteer
from locations.models import Barangay
from .serializers import (
    SupplyCategorySerializer,
    SupplySerializer,
    EvacuationCenterSerializer,
    EquipmentSerializer,
    VolunteerSerializer,
)
from accounts.permissions import IsStaffOrReadOnly
from io import TextIOWrapper
from decimal import Decimal, InvalidOperation
import csv

from .evacuation import (
    DEFAULT_NEARBY_LIMIT,
    MAX_NEARBY_LIMIT,
    distance_km,
    normalize_status,
    pick_nearby,
)


class SupplyCategoryViewSet(viewsets.ModelViewSet):
    queryset = SupplyCategory.objects.all()
    serializer_class = SupplyCategorySerializer
    authentication_classes = [SessionAuthentication, TokenAuthentication]
    permission_classes = [IsStaffOrReadOnly]
    search_fields = ['name', 'description']


class SupplyViewSet(viewsets.ModelViewSet):
    queryset = Supply.objects.select_related('category').all()
    serializer_class = SupplySerializer
    authentication_classes = [SessionAuthentication, TokenAuthentication]
    permission_classes = [IsStaffOrReadOnly]
    search_fields = ['name', 'storage_location']
    ordering_fields = ['name', 'quantity', 'created_at']

    def get_queryset(self):
        queryset = super().get_queryset()

        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category_id=category)

        status = self.request.query_params.get('status')
        if status:
            queryset = queryset.filter(status=status)

        return queryset


class EvacuationCenterViewSet(viewsets.ModelViewSet):
    queryset = EvacuationCenter.objects.select_related('barangay').all()
    serializer_class = EvacuationCenterSerializer
    authentication_classes = [SessionAuthentication, TokenAuthentication]
    permission_classes = [IsStaffOrReadOnly]
    search_fields = ['name', 'address']

    @action(
        detail=False,
        methods=['get'],
        permission_classes=[permissions.AllowAny],
        authentication_classes=[],
    )
    def geojson(self, request):
        centers = self.get_queryset()
        features = []

        for center in centers:
            features.append({
                "type": "Feature",
                "properties": {
                    "id": str(center.id),
                    "name": center.name,
                    "address": center.address,
                    "barangay": center.barangay.name if center.barangay else None,
                    "capacity": center.capacity,
                    "current_occupancy": center.current_occupancy,
                    "available_slots": center.available_slots,
                    "status": center.status,
                    "is_accepting_evacuees": center.is_accepting_evacuees,
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [
                        float(center.longitude),
                        float(center.latitude),
                    ],
                },
            })

        return Response({
            "type": "FeatureCollection",
            "features": features,
        })

    def _parse_user_location(self, request):
        """Read ?latitude=&longitude= from the query string. Returns (lat, lng, error_response)."""
        try:
            latitude = float(request.query_params['latitude'])
            longitude = float(request.query_params['longitude'])
        except (KeyError, TypeError, ValueError):
            return None, None, Response(
                {"error": "latitude and longitude must be valid numbers."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
            return None, None, Response(
                {"error": "latitude or longitude is outside its valid range."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return latitude, longitude, None

    def _rank_by_distance(self, latitude, longitude):
        """All centers as (center, distance_km, accepting) tuples, closest first."""
        ranked = [
            (
                center,
                distance_km(latitude, longitude, float(center.latitude), float(center.longitude)),
                center.is_accepting_evacuees,
            )
            for center in self.get_queryset()
        ]
        ranked.sort(key=lambda item: item[1])
        return ranked

    @staticmethod
    def _with_distance(item):
        center, distance, _accepting = item
        data = EvacuationCenterSerializer(center).data
        data['distance_km'] = round(distance, 2)
        return data

    @action(
        detail=False,
        methods=['get'],
        permission_classes=[permissions.AllowAny],
        authentication_classes=[],
    )
    def nearby(self, request):
        """
        Recommend evacuation centers near an approximate user location.

        GET /api/resources/evacuation-centers/nearby/?latitude=13.94&longitude=121.62&limit=5

        - results: the `limit` (default 5) closest centers that still accept evacuees
          (status Available). If not enough are available, the closest others fill the list.
        - not_accepting_nearby: closer centers that are Full / Closed / Under Maintenance.
        """
        latitude, longitude, error = self._parse_user_location(request)
        if error:
            return error

        try:
            limit = int(request.query_params.get('limit', DEFAULT_NEARBY_LIMIT))
        except (TypeError, ValueError):
            limit = DEFAULT_NEARBY_LIMIT
        limit = max(1, min(limit, MAX_NEARBY_LIMIT))

        ranked = self._rank_by_distance(latitude, longitude)
        recommended, not_accepting = pick_nearby(ranked, limit)

        return Response({
            'user_location': {'latitude': latitude, 'longitude': longitude},
            'limit': limit,
            'total_centers': len(ranked),
            'accepting_count': sum(1 for item in ranked if item[2]),
            'results': [self._with_distance(item) for item in recommended],
            'not_accepting_nearby': [self._with_distance(item) for item in not_accepting],
        })

    @action(
        detail=False,
        methods=['get'],
        permission_classes=[permissions.AllowAny],
        authentication_classes=[],
    )
    def nearest(self, request):
        """Return the single closest center, preferring centers that still accept evacuees."""
        latitude, longitude, error = self._parse_user_location(request)
        if error:
            return error

        ranked = self._rank_by_distance(latitude, longitude)
        if not ranked:
            return Response({"detail": "No evacuation centers are available."}, status=status.HTTP_404_NOT_FOUND)

        recommended, _ = pick_nearby(ranked, 1)
        response_data = self._with_distance(recommended[0])
        response_data['user_location'] = {"latitude": latitude, "longitude": longitude}
        return Response(response_data)


class EquipmentViewSet(viewsets.ModelViewSet):
    queryset = Equipment.objects.all()
    serializer_class = EquipmentSerializer
    authentication_classes = [SessionAuthentication, TokenAuthentication]
    permission_classes = [IsStaffOrReadOnly]
    search_fields = ['name', 'serial_number', 'asset_number']
    ordering_fields = ['name', 'equipment_type', 'status']

    def get_queryset(self):
        queryset = super().get_queryset()

        equipment_type = self.request.query_params.get('type')
        if equipment_type:
            queryset = queryset.filter(equipment_type=equipment_type)

        status = self.request.query_params.get('status')
        if status:
            queryset = queryset.filter(status=status)

        return queryset


class VolunteerViewSet(viewsets.ModelViewSet):
    queryset = Volunteer.objects.select_related('barangay').all()
    serializer_class = VolunteerSerializer
    authentication_classes = [SessionAuthentication, TokenAuthentication]
    permission_classes = [IsStaffOrReadOnly]
    search_fields = ['full_name', 'contact_number', 'email']
    ordering_fields = ['full_name', 'created_at']

    def get_queryset(self):
        queryset = super().get_queryset()

        barangay = self.request.query_params.get('barangay')
        if barangay:
            queryset = queryset.filter(barangay_id=barangay)

        status = self.request.query_params.get('status')
        if status:
            queryset = queryset.filter(status=status)

        return queryset


class ResourcesSummaryViewSet(viewsets.ViewSet):
    authentication_classes = [SessionAuthentication, TokenAuthentication]
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def list(self, request):
        supply_stats = Supply.objects.values('status').annotate(
            count=Count('id'),
            total_quantity=Sum('quantity'),
        )

        equipment_stats = Equipment.objects.values('status').annotate(
            count=Count('id'),
        )

        volunteer_stats = Volunteer.objects.values('status').annotate(
            count=Count('id'),
        )

        center_count = EvacuationCenter.objects.count()

        return Response({
            "supplies": {
                item['status']: {
                    'count': item['count'],
                    'total_quantity': float(item['total_quantity']) if item['total_quantity'] else 0,
                }
                for item in supply_stats
            },
            "equipment": {
                item['status']: item['count']
                for item in equipment_stats
            },
            "volunteers": {
                item['status']: item['count']
                for item in volunteer_stats
            },
            "evacuation_centers": center_count,
        })


@api_view(['POST'])
@permission_classes([IsStaffOrReadOnly])
def import_evacuation_centers_csv(request):
    if 'file' not in request.FILES:
        return Response({"error": "No file uploaded."}, status=status.HTTP_400_BAD_REQUEST)

    csv_file = request.FILES['file']
    if not csv_file.name.endswith('.csv'):
        return Response({"error": "Invalid format. Please upload a .csv file."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        decoded_file = TextIOWrapper(csv_file.file, encoding='utf-8')
        reader = csv.DictReader(decoded_file)

        # Required columns based on your EvacuationCenter model
        required_fields = {'name', 'latitude', 'longitude'}
        if not required_fields.issubset(set(reader.fieldnames or [])):
            return Response({
                "error": f"CSV must contain columns: {', '.join(required_fields)}"
            }, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            created = 0
            updated = 0
            errors = []

            for i, row in enumerate(reader, start=2):  # start=2 skips header
                try:
                    name = row['name'].strip()
                    if not name:
                        raise ValueError("Name cannot be empty")

                    lat = Decimal(row['latitude'])
                    lng = Decimal(row['longitude'])

                    # Optional: Link to Barangay if name matches
                    barangay = None
                    brgy_name = row.get('barangay', '').strip()
                    if brgy_name:
                        try:
                            barangay = Barangay.objects.get(name__iexact=brgy_name)
                        except Barangay.DoesNotExist:
                            errors.append(f"Row {i}: Barangay '{brgy_name}' not found. Center saved without link.")
                            # Non-fatal: continues import but logs warning

                    defaults = {
                        'latitude': lat,
                        'longitude': lng,
                        'address': (row.get('address') or '').strip(),
                        'barangay': barangay,
                    }

                    # Optional columns. Only overwrite what the CSV actually provides,
                    # so re-uploading a file without them keeps the saved numbers.
                    for column in ('capacity', 'current_occupancy'):
                        raw_value = (row.get(column) or '').strip()
                        if raw_value:
                            number = int(float(raw_value))
                            if number < 0:
                                raise ValueError(f"{column} cannot be negative")
                            defaults[column] = number

                    raw_status = (row.get('status') or '').strip()
                    if raw_status:
                        normalized = normalize_status(raw_status)
                        if not normalized:
                            raise ValueError(
                                f"Unknown status '{raw_status}'. Use Available, Full, Closed, or Under Maintenance."
                            )
                        defaults['status'] = normalized

                    existing = EvacuationCenter.objects.filter(name=name).first()
                    capacity = defaults.get('capacity', existing.capacity if existing else 0)
                    occupancy = defaults.get('current_occupancy', existing.current_occupancy if existing else 0)
                    if capacity > 0 and occupancy > capacity:
                        raise ValueError(
                            f"current_occupancy ({occupancy}) cannot be higher than capacity ({capacity})"
                        )

                    # Create or update center (save() keeps the status in line with the numbers)
                    obj, is_created = EvacuationCenter.objects.update_or_create(
                        name=name,
                        defaults=defaults,
                    )

                    if is_created:
                        created += 1
                    else:
                        updated += 1

                except (InvalidOperation, ValueError, KeyError) as e:
                    errors.append(f"Row {i}: {str(e)}")

            return Response({
                "status": "success",
                "created": created,
                "updated": updated,
                "errors": errors[:10]  # Cap errors for clean frontend UI
            }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({"error": f"Server error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)