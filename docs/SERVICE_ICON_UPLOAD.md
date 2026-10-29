# Service icon upload

In Admin, open **Services & pricing**, find the service or installation, select **Change icon**, upload the file, review the preview and select **Save icon**. Uploading alone does not change the customer catalogue. The full service editor uses the same upload component.

Published services show the saved icon on customer service cards and service details. Draft services remain hidden. Replace an icon by uploading another file; select **Remove icon**, then **Save icon**, to restore the default customer icon.

SVG, PNG, JPEG and WebP files are supported up to 256 KB. Static SVGs are validated on the server; scripts, embedded content and external references are rejected. Missing SVG namespaces are added so standalone images render correctly. Upload errors are displayed beside the input, and failed uploads can be retried, including selecting the same filename.

The dedicated `PATCH /api/v1/admin/catalogue/services/:id/icon` endpoint changes only `icon_object_key`, validates the uploaded media reference and requires an administrator. It preserves service names, pricing, booking questions and publication status. The public media endpoint serves only media attached to a published service or appliance.

Verified with SVG validation tests, a real database/object-storage integration test and a browser test covering upload, rejection/retry, preview, save, replacement, customer card/detail rendering and removal.
