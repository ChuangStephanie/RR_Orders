export const baseURL = "http://localhost:3000/api";

export async function sortShippingLabels(excel, zip, name) {
  console.log(`Sending excel: ${excel}, zip: ${zip}, sheet name: ${name}`);

  const formData = new FormData();
  formData.append("excel", excel);
  formData.append("zip", zip);
  formData.append("sheetName", name);

  try {
    const response = await fetch(`${baseURL}/upload`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.ok}`);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "mergedPdf.zip";
    document.body.appendChild(link);
    link.click();

    // cleanup after download
    setTimeout(() => window.URL.revokeObjectURL(url), 10000);

    return { status: "success", message: "File downloaded" };
  } catch (error) {
    console.error("Error sorting labels:", error);
    return { status: "error", message: error.message };
  }
}
