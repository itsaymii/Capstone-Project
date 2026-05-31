from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.authentication import TokenAuthentication, SessionAuthentication
from django.db.models import Count, Sum
from django.db import transaction
from .models import SupplyCategory, Supply, EvacuationCenter, Equipment, Volunteer
from locations.models import Barangay
from .serializers import (
    SupplyCategorySerializer, SupplySerializer,
    EvacuationCenterSerializer, EquipmentSerializer,
    VolunteerSerializer
)
from accounts.permissions import IsStaffOrReadOnly
from io import TextIOWrapper
from decimal import Decimal, InvalidOperation
import csv


class SupplyCategoryViewSet(viewsets.ModelViewSet):
    """API endpoint for supply categories"""
    queryset = SupplyCategory.objects.all()
    serializer_class = SupplyCategorySerializer
    authentication_classes = [SessionAuthentication, TokenAuthentication]
    permission_classes = [IsStaffOrReadOnly]
    search_fields = ['name', 'description']


class SupplyViewSet(viewsets.ModelViewSet):
    """API endpoint for supplies"""
    queryset = Supply.objects.select_related('category').all()
    serializer_class = SupplySerializer
    authentication_classes = [SessionAuthentication, TokenAuthentication]
    permission_classes = [IsStaffOrReadOnly]
    search_fields = ['name', 'storage_location']
    ordering_fields = ['name', 'quantity', 'created_at']
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filter by category
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category_id=category)
        
        # Filter by status
        status = self.request.query_params.get('status')
        if status:
            queryset = queryset.filter(status=status)
        
        return queryset


class EvacuationCenterViewSet(viewsets.ModelViewSet):
    """API endpoint for evacuation centers"""
    queryset = EvacuationCenter.objects.select_related('barangay').all()
    serializer_class = EvacuationCenterSerializer
    authentication_classes = [SessionAuthentication, TokenAuthentication]
    permission_classes = [IsStaffOrReadOnly]
    search_fields = ['name', 'address']
    
    @action(detail=False, methods=['get'])
    def geojson(self, request):
        """Return evacuation centers as GeoJSON"""
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
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [float(center.longitude), float(center.latitude)]
                }
            })
        
        return Response({
            "type": "FeatureCollection",
            "features": features
        })


class EquipmentViewSet(viewsets.ModelViewSet):
    """API endpoint for equipment"""
    queryset = Equipment.objects.all()
    serializer_class = EquipmentSerializer
    authentication_classes = [SessionAuthentication, TokenAuthentication]
    permission_classes = [IsStaffOrReadOnly]
    search_fields = ['name', 'serial_number', 'asset_number']
    ordering_fields = ['name', 'equipment_type', 'status']
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filter by type
        equipment_type = self.request.query_params.get('type')
        if equipment_type:
            queryset = queryset.filter(equipment_type=equipment_type)
        
        # Filter by status
        status = self.request.query_params.get('status')
        if status:
            queryset = queryset.filter(status=status)
        
        return queryset


class VolunteerViewSet(viewsets.ModelViewSet):
    """API endpoint for volunteers"""
    queryset = Volunteer.objects.select_related('barangay').all()
    serializer_class = VolunteerSerializer
    authentication_classes = [SessionAuthentication, TokenAuthentication]
    permission_classes = [IsStaffOrReadOnly]
    search_fields = ['full_name', 'contact_number', 'email']
    ordering_fields = ['full_name', 'created_at']
    
    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filter by barangay
        barangay = self.request.query_params.get('barangay')
        if barangay:
            queryset = queryset.filter(barangay_id=barangay)
        
        # Filter by status
        status = self.request.query_params.get('status')
        if status:
            queryset = queryset.filter(status=status)
        
        return queryset


class ResourcesSummaryViewSet(viewsets.ViewSet):
    """API endpoint for resources summary statistics"""
    authentication_classes = [SessionAuthentication, TokenAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    
    def list(self, request):
        # Supply stats
        supply_stats = Supply.objects.values('status').annotate(
            count=Count('id'),
            total_quantity=Sum('quantity')
        )
        
        # Equipment stats
        equipment_stats = Equipment.objects.values('status').annotate(
            count=Count('id')
        )
        
        # Volunteer stats
        volunteer_stats = Volunteer.objects.values('status').annotate(
            count=Count('id')
        )
        
        # Evacuation center count
        center_count = EvacuationCenter.objects.count()
        
        return Response({
            "supplies": {
                item['status']: {
                    'count': item['count'],
                    'total_quantity': float(item['total_quantity']) if item['total_quantity'] else 0
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

                    # Create or update center
                    obj, is_created = EvacuationCenter.objects.update_or_create(
                        name=name,
                        defaults={
                            'latitude': lat,
                            'longitude': lng,
                            'address': row.get('address', '').strip(),
                            'barangay': barangay
                        }
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