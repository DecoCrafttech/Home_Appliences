UPDATE service_catalogue SET active=false WHERE appliance_category_id IN (SELECT id FROM appliance_categories WHERE lower(regexp_replace(name,'[^a-zA-Z]','','g')) IN ('mixergrinder','mixer','grinder'));
UPDATE appliance_categories SET active=false WHERE lower(regexp_replace(name,'[^a-zA-Z]','','g')) IN ('mixergrinder','mixer','grinder');
