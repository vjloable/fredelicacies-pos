#!/bin/bash

SUPABASE_URL="https://ezokpffwpracpsdzooqm.supabase.co"
# Use your service role key here (not the anon key) so the script can write
SUPABASE_SERVICE_KEY="YOUR_SERVICE_ROLE_KEY"

ACTION=$1

if [[ "$ACTION" != "on" && "$ACTION" != "off" ]]; then
  echo "Usage: ./maintenance.sh on | off"
  exit 1
fi

if [[ "$ACTION" == "on" ]]; then
  VALUE="true"
  LABEL="ON  🔴"
else
  VALUE="false"
  LABEL="OFF 🟢"
fi

echo "Setting maintenance mode → $LABEL"

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X PATCH "$SUPABASE_URL/rest/v1/settings?id=eq.global" \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d "{\"maintenance_mode\": $VALUE}")

if [[ "$HTTP_STATUS" == "204" ]]; then
  echo "Done. Maintenance mode is now $LABEL"
else
  echo "Error — HTTP $HTTP_STATUS. Check your service role key and Supabase URL."
  exit 1
fi
