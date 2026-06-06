from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.authentication import TokenAuthentication, SessionAuthentication
from django.db.models import Count, Sum

from .models import SupplyCategory, Supply, EvacuationCenter, Equipment, Volunteer
from .serializers import (
    SupplyCategorySerializer,
    SupplySerializer,
    EvacuationCenterSerializer,
    EquipmentSerializer,
    VolunteerSerializer,
)
from accounts.permissions import IsStaffOrReadOnly


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
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
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