#!/bin/bash
TOKEN=$(curl -s -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"testuser1@example.com\",\"password\":\"letmein\"}" | sed 's/.*"token":"\([^"]*\)".*/\1/')
echo $TOKEN