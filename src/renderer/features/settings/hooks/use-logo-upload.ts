import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

export function useLogoUpload(initialFileName: string | null = null) {
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<string | null>(initialFileName);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadLogo = useCallback(async (fileName: string) => {
    try {
      if (!window.ipcRenderer) return;
      const result = (await window.ipcRenderer.invoke("get-logo", { fileName })) as {
        success: boolean;
        fileData?: string;
      };
      if (result.success && result.fileData) {
        setLogoPreview(result.fileData);
      }
    } catch (error) {
      console.error("Error loading logo:", error);
    }
  }, []);

  const handleLogoSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/png", "image/jpeg", "image/jpg"].includes(file.type)) {
      toast.error("Formato no válido", { description: "Solo se permiten archivos PNG o JPG" });
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("Archivo muy grande", { description: "El tamaño máximo es 2MB" });
      return;
    }

    setIsUploadingLogo(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        if (!window.ipcRenderer) return;

        const result = (await window.ipcRenderer.invoke("upload-logo", {
          fileName: file.name,
          fileData: base64,
        })) as { success: boolean; fileName?: string; message?: string };

        if (result.success && result.fileName) {
          setLogoPreview(base64);
          setLogoFile(result.fileName);
          toast.success("Logo cargado", { description: "El logo se guardó correctamente" });
        } else {
          toast.error("Error al cargar logo", { description: result.message });
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Error uploading logo:", error);
      toast.error("Error al cargar logo");
    } finally {
      setIsUploadingLogo(false);
    }
  }, []);

  const handleRemoveLogo = useCallback(async () => {
    if (!logoFile) return;
    try {
      if (!window.ipcRenderer) return;
      await window.ipcRenderer.invoke("delete-logo", { fileName: logoFile });
      setLogoPreview(null);
      setLogoFile(null);
      toast.success("Logo eliminado");
    } catch (error) {
      console.error("Error removing logo:", error);
      toast.error("Error al eliminar logo");
    }
  }, [logoFile]);

  return {
    logoPreview,
    setLogoPreview,
    logoFile,
    setLogoFile,
    isUploadingLogo,
    fileInputRef,
    loadLogo,
    handleLogoSelect,
    handleRemoveLogo,
  };
}
