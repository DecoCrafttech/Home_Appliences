import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AsyncActionButton,
  ConfirmActionDialog,
  useSafeMutation,
} from "@home/ui";
import axios from "axios";
import { toast } from "sonner";
import { api } from "./api";
import { adminKeys } from "./design";
import { CatalogueIconUpload } from "./CatalogueIconUpload";
import type { ManagedService } from "./Catalogue";

export function ServiceIconEditor({
  service,
  onClose,
}: {
  service: ManagedService;
  onClose: () => void;
}) {
  const [icon, setIcon] = useState(service.icon_object_key || null);
  const [preview, setPreview] = useState(service.icon_preview_url || "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const qc = useQueryClient();
  const save = useSafeMutation(async () => {
    await api.patch(`/catalogue/services/${service.id}/icon`, {
      iconObjectKey: icon,
    });
    await qc.invalidateQueries({ queryKey: adminKeys.catalogue });
    return true;
  });
  const pending = uploading || save.isPending;
  return (
    <ConfirmActionDialog
      title={`Service icon: ${service.name}`}
      onClose={onClose}
      pending={pending}
    >
      <p>
        {service.publication_status === "DRAFT"
          ? "This service is a draft. Its icon will appear to customers when the service is published."
          : "Save to update the icon on the customer service card and detail page."}
      </p>
      <fieldset disabled={pending}>
        <CatalogueIconUpload
          preview={preview}
          onBusyChange={setUploading}
          onChange={(key, url) => {
            setIcon(key);
            setPreview(url);
            setError("");
          }}
        />
      </fieldset>
      {error && (
        <p role="alert" className="safe-error">
          {error}
        </p>
      )}
      <div className="workflow-actions">
        <button type="button" onClick={onClose} disabled={pending}>
          Cancel
        </button>
        <AsyncActionButton
          className="primary"
          pending={pending}
          pendingLabel={uploading ? "Uploading..." : "Saving..."}
          disabled={icon === (service.icon_object_key || null)}
          onClick={async () => {
            setError("");
            try {
              if (await save.run(undefined)) {
                toast.success("Service icon saved.");
                onClose();
              }
            } catch (cause) {
              setError(
                axios.isAxiosError(cause)
                  ? cause.response?.data?.error?.message ||
                      "Unable to save the icon. Try again."
                  : "Unable to save the icon. Try again.",
              );
            }
          }}
        >
          Save icon
        </AsyncActionButton>
      </div>
    </ConfirmActionDialog>
  );
}
