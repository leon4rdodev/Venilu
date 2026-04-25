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
      const processImage = new Promise<void>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          
          const img = new Image();
          img.onload = async () => {
            try {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              if (!ctx) throw new Error("Could not get canvas context");
              
              canvas.width = img.width;
              canvas.height = img.height;
              
              // Draw image
              ctx.drawImage(img, 0, 0);
              
              // Convert to grayscale
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const data = imageData.data;
              
              for (let i = 0; i < data.length; i += 4) {
                 const r = data[i];
                 const g = data[i + 1];
                 const b = data[i + 2];
                 
                 // Grayscale (Luminance)
                 const v = 0.2126 * r + 0.7152 * g + 0.0722 * b;
                 
                 data[i] = v;     // R
                 data[i + 1] = v; // G
                 data[i + 2] = v; // B
                 // Alpha remains the same
              }
              
              ctx.putImageData(imageData, 0, 0);
              const processedBase64 = canvas.toDataURL('image/png');
              
              if (!window.ipcRenderer) {
                  resolve();
                  return;
              }

              const result = (await window.ipcRenderer.invoke("upload-logo", {
                fileName: file.name,
                fileData: processedBase64,
              })) as { success: boolean; fileName?: string; message?: string };

              if (result.success && result.fileName) {
                setLogoPreview(processedBase64);
                setLogoFile(result.fileName);
                toast.success("Logo cargado", { description: "El logo se procesó a escala de grises y se guardó" });
              } else {
                toast.error("Error al cargar logo", { description: result.message });
              }
              resolve();
            } catch (err) {
              reject(err);
            }
          };
          img.onerror = () => reject(new Error("Error loading image for processing"));
          img.src = base64;
        };
        reader.onerror = () => reject(new Error("Error reading file"));
        reader.readAsDataURL(file);
      });

      await processImage;
    } catch (error) {
      console.error("Error uploading logo:", error);
      toast.error("Error al procesar el logo");
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
