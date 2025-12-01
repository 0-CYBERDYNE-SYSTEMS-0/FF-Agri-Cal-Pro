#!/bin/bash
echo "Testing /api/reverse-geocode endpoint..."
echo ""
echo "Test 1: Eugene, Oregon coordinates (44.0521, -123.0868)"
curl -s "http://localhost:5000/api/reverse-geocode?lat=44.0521&lon=-123.0868" | jq '.'
echo ""
echo ""
echo "Test 2: Portland, Oregon coordinates (45.5152, -122.6784)"
curl -s "http://localhost:5000/api/reverse-geocode?lat=45.5152&lon=-122.6784" | jq '.'
echo ""
echo ""
echo "Test 3: Invalid coordinates (missing lon)"
curl -s "http://localhost:5000/api/reverse-geocode?lat=44.0521" | jq '.'
echo ""
echo ""
echo "Test 4: Out of range coordinates"
curl -s "http://localhost:5000/api/reverse-geocode?lat=200&lon=-123" | jq '.'
