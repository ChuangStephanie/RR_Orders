const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const unzipper = require("unzipper");
const archiver = require("archiver");
const app = express();
const { PDFDocument } = require("pdf-lib");

// upload path
const upload = multer({ dest: path.join(__dirname, "db", "uploads") });

app.post(
  "/api/upload",
  upload.fields([{ name: "excel" }, { name: "zip" }]),
  async (req, res) => {
    try {
      // Read Excel file
      const excelFilePath = req.files.excel[0].path;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(excelFilePath);

      // Sheet name from the request
      const sheetName = req.body.sheetName;
      const sheet = workbook.getWorksheet(sheetName);

      if (!sheet) {
        return res.status(404).json({
          message: `Sheet "${sheetName}" not found in the Excel file.`,
        });
      }

      // Find columns by name
      let orderNumberColumnIndex = -1;
      let modelColumnIndex = -1;

      sheet.getRow(1).eachCell((cell, colNumber) => {
        const header = (cell.value || "").toString().toLowerCase();

        if (header.includes("platform order number")) {
          orderNumberColumnIndex = colNumber;
        }
        if (header.includes("suitable model")) {
          modelColumnIndex = colNumber;
        }
      });

      if (orderNumberColumnIndex === -1 || modelColumnIndex === -1) {
        return res.status(400).json({
          message:
            'Could not find required columns: "Platform Order Number" or "Suitable Model" in the sheet.',
        });
      }

      // Process data from sheet
      const rows = sheet.getRows(2, sheet.rowCount); 
      const labels = {}; 

      rows.forEach((row) => {
        const orderNumber = row.getCell(orderNumberColumnIndex).value;
        const modelName = row.getCell(modelColumnIndex).value;

        if (orderNumber && modelName) {
          if (!labels[modelName]) {
            labels[modelName] = [];
          }
          labels[modelName].push(orderNumber);
        }
      });

      // Process the zip file
      const zipFilePath = req.files.zip[0].path;
      const extractPath = path.join(__dirname, "db", "uploads", "labels"); 
      fs.mkdirSync(extractPath, { recursive: true });

      // Extract zip
      const unzipStream = fs
        .createReadStream(zipFilePath)
        .pipe(unzipper.Extract({ path: extractPath }));

      unzipStream.on("close", async () => {
        const archive = archiver("zip", { zlib: { level: 9 } });
        res.setHeader("Content-Type", "application/zip");
        res.setHeader(
          "Content-Disposition",
          'attachment; filename="merged_pdfs.zip"'
        );

        archive.pipe(res);

        // Move and process label files
        for (const model in labels) {
          const modelFiles = [];

          for (const orderNumber of labels[model]) {
            const extractedFiles = fs.readdirSync(extractPath);
            const matchingFiles = extractedFiles.filter((file) =>
              file.toLowerCase().trim().includes(orderNumber.toLowerCase().trim())
            );

            matchingFiles.forEach((file) => {
              const filePath = path.join(extractPath, file);
              if (fs.existsSync(filePath)) {
                modelFiles.push(filePath);
              }
            });
          }

          if (modelFiles.length > 0) {
            const mergedPdfBytes = await mergePdfs(modelFiles);
            archive.append(Buffer.from(mergedPdfBytes), { name: `${model}.pdf` });
          }
        }

        archive.finalize();

        // Clean up temporary files
        fs.unlinkSync(excelFilePath);
        fs.unlinkSync(zipFilePath);
        clearUploadsFolder(path.join(__dirname, "db", "uploads"));
      });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ message: "An error occurred while processing the request." });
    }
  }
);

async function mergePdfs(files) {
  const mergedPdf = await PDFDocument.create();

  for (const file of files) {
    const pdfBytes = fs.readFileSync(file);
    const pdf = await PDFDocument.load(pdfBytes);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }

  return await mergedPdf.save();
}

function clearUploadsFolder(folderPath) {
  try {
    const files = fs.readdirSync(folderPath);
    files.forEach((file) => {
      const filePath = path.join(folderPath, file);
      const stats = fs.statSync(filePath);

      if (stats.isDirectory()) {
        clearUploadsFolder(filePath);
        fs.rmdirSync(filePath);
      } else {
        fs.unlinkSync(filePath);
      }
    });
  } catch (err) {
    console.error("Error clearing uploads folder:", err);
  }
}

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
