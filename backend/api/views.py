from rest_framework.decorators import api_view
from rest_framework.response import Response


@api_view(['GET'])
def test_connection(request):
	return Response({'message': 'Backend connected successfully'})

# Create your views here.
