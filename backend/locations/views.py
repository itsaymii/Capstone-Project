from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.authentication import TokenAuthentication, SessionAuthentication
from .models import Barangay, Location, PopulationDensity, EarthquakeFaultLine
from .serializers import (
    BarangaySerializer, BarangayGeoJSONSerializer,
    LocationSerializer, PopulationDensitySerializer,
    EarthquakeFaultLineSerializer
)
from accounts.permissions import IsStaffOrReadOnly


class BarangayViewSet(viewsets.ModelViewSet):
    """
    API endpoint for barangays.
    GET: List all barangays
    POST: Create new barangay (staff/admin only)
    """
    queryset = Barangay.objects.all()
    serializer_class = BarangaySerializer
    authentication_classes = [SessionAuthentication, TokenAuthentication]
    permission_classes = [IsStaffOrReadOnly]
    search_fields = ['name', 'city', 'province']
    ordering_fields = ['name', 'province', 'city']
    
    @action(detail=False, methods=['get'])
    def geojson(self, request):
        """Return barangays as GeoJSON"""
        barangays = self.get_queryset()
        serializer = BarangayGeoJSONSerializer(barangays, many=True)
        return Response({
            "type": "FeatureCollection",
            "features": serializer.data
        })


class LocationViewSet(viewsets.ModelViewSet):
    """API endpoint for locations"""
    queryset = Location.objects.all()
    serializer_class = LocationSerializer
    authentication_classes = [SessionAuthentication, TokenAuthentication]
    permission_classes = [IsStaffOrReadOnly]
    search_fields = ['address', 'barangay__name']
    ordering_fields = ['created_at', 'address']


class PopulationDensityViewSet(viewsets.ModelViewSet):
    """API endpoint for population density"""
    queryset = PopulationDensity.objects.all()
    serializer_class = PopulationDensitySerializer
    authentication_classes = [SessionAuthentication, TokenAuthentication]
    permission_classes = [IsStaffOrReadOnly]


class EarthquakeFaultLineViewSet(viewsets.ModelViewSet):
    """API endpoint for earthquake fault lines"""
    queryset = EarthquakeFaultLine.objects.all()
    serializer_class = EarthquakeFaultLineSerializer
    authentication_classes = [SessionAuthentication, TokenAuthentication]
    permission_classes = [IsStaffOrReadOnly]