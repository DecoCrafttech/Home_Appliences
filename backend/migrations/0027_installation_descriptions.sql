UPDATE service_catalogue s SET description = CASE
 WHEN lower(s.name) LIKE '%uninstall%' THEN 'Disconnect and remove your ' || lower(a.name) || ' safely.'
 WHEN lower(s.name) LIKE '%reinstall%' THEN 'Reconnect and set up your ' || lower(a.name) || ' at its new location.'
 WHEN lower(s.name) LIKE '%wall mount%' THEN 'Mount your television on the wall and check its positioning and connections.'
 WHEN lower(s.name) LIKE '%table%' THEN 'Set up your television on its stand and check its connections.'
 WHEN a.slug='washing-machine' THEN 'Set up your washing machine and check water, drainage and power connections.'
 WHEN a.slug='water-purifier' THEN 'Set up your water purifier and check water connections and flow.'
 WHEN a.slug='air-conditioner' THEN 'Position and connect your air conditioner for installation.'
 ELSE 'Set up your ' || lower(a.name) || ' and check its connections.'
 END FROM appliance_categories a WHERE a.id=s.appliance_category_id AND s.request_type='INSTALLATION' AND trim(s.description)='';
