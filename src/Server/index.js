const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const unzipper = require("unzipper");
const app = express();
const { PDFDocument } = require("pdf-lib");

// upload path
const upload = multer({ dest: path.join(__dirname, "db", "uploads") });

function clearProcessedFolder(folderPath) {
  try {
    const files = fs.readdirSync(folderPath);
    files.forEach((file) => {
      const filePath = path.join(folderPath, file);
      const stats = fs.statSync(filePath);

      if (stats.isDirectory()) {
        clearProcessedFolder(filePath); // Recursively clear subdirectories
        fs.rmdirSync(filePath); // Remove directory
      } else {
        fs.unlinkSync(filePath); // Remove file
      }
    });
    console.log("Processed folder cleared");
  } catch (err) {
    console.error("Error clearing processed folder:", err);
  }
}

app.post(
  "/api/upload",
  upload.fields([{ name: "excel" }, { name: "zip" }]),
  async (req, res) => {
    try {
      // Clear the processed folder before starting
      const processedPath = path.join(__dirname, "db", "processed");
      clearProcessedFolder(processedPath);

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

      // Find column index by header
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
      const rows = sheet.getRows(2, sheet.rowCount); // Skip the header row
      const labels = {}; // Object to hold grouped labels by model

      // Group by model
      rows.forEach((row) => {
        const orderNumber = row.getCell(orderNumberColumnIndex).value;
        const modelName = row.getCell(modelColumnIndex).value;

        if (orderNumber && modelName) {
          if (!labels[modelName]) {
            labels[modelName] = [];
          }
          labels[modelName].push(orderNumber);
          console.log("order number:", orderNumber, "model name:", modelName);
        }
      });

      // Process the zip file
      const zipFilePath = req.files.zip[0].path;
      const extractPath = path.join(__dirname, "db", "uploads", "labels"); // Extract path updated
      fs.mkdirSync(extractPath, { recursive: true });

      // Extract zip
      const unzipStream = fs
        .createReadStream(zipFilePath)
        .pipe(unzipper.Extract({ path: extractPath }));
      unzipStream.on("close", async () => {
        // Path to save processed folders
        const processedPath = path.join(__dirname, "db", "processed");
        fs.mkdirSync(processedPath, { recursive: true }); // Ensure the processed folder exists

        // Move label files to the correct subfolders based on model
        await moveLabels(labels, extractPath, processedPath);

        // Clean up after file processing
        fs.unlinkSync(excelFilePath);
        fs.unlinkSync(zipFilePath);

        // Clear the uploads folder after processing
        clearUploadsFolder(path.join(__dirname, "db", "uploads"));

        // Response
        res.json({
          message:
            "Labels sorted and moved into grouped folders by model. Check the processed folder for the files.",
        });
      });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ message: "An error occurred while processing the request." });
    }
  }
);

// Move label files into model-specific subfolders
async function mergePdfs(files) {
  const mergedPdf = await PDFDocument.create();

  for (const file of files) {
    const pdfBytes = fs.readFileSync(file);
    const pdf = await PDFDocument.load(pdfBytes);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }

  const mergedPdfBytes = await mergedPdf.save();
  return mergedPdfBytes;
}

async function moveLabels(labels, extractPath, processedPath) {
  for (const model in labels) {
    const modelFiles = [];

    // Find the files in the extracted folder that match the order numbers for this model
    for (const orderNumber of labels[model]) {
      console.log(`Looking for files for order number: ${orderNumber}`);

      // Extract all filenames from the folder
      const extractedFiles = fs.readdirSync(extractPath);
      console.log("Extracted files:", extractedFiles); // Log extracted files for debugging

      // Remove any extra spaces and check if the order number is a substring of the filename
      const matchingFiles = extractedFiles.filter((file) =>
        file.toLowerCase().trim().includes(orderNumber.toLowerCase().trim())
      );

      // Log matching files for debugging
      console.log("Matching files:", matchingFiles);

      // Add matching PDF files to the modelFiles array
      matchingFiles.forEach((file) => {
        const filePath = path.join(extractPath, file);
        if (fs.existsSync(filePath)) {
          modelFiles.push(filePath); // Add file to the model's list
        }
      });
    }

    if (modelFiles.length > 0) {
      console.log(`Merging PDF files for model: ${model}`);

      // Merge all the PDF files
      const mergedPdfBytes = await mergePdfs(modelFiles);

      // Create the processed file path for the model
      const outputFilePath = path.join(processedPath, `${model}.pdf`);
      fs.writeFileSync(outputFilePath, mergedPdfBytes); // Save the merged PDF file

      console.log(
        `Processed file for model ${model} created: ${outputFilePath}`
      );
    }
  }
}

// Function to clear the uploads folder
function clearUploadsFolder(folderPath) {
  try {
    const files = fs.readdirSync(folderPath);
    files.forEach((file) => {
      const filePath = path.join(folderPath, file);
      const stats = fs.statSync(filePath);

      if (stats.isDirectory()) {
        clearUploadsFolder(filePath); // Recursively clear subdirectories
        fs.rmdirSync(filePath); // Remove directory
      } else {
        fs.unlinkSync(filePath); // Remove file
      }
    });
    console.log("Uploads folder cleared");
  } catch (err) {
    console.error("Error clearing uploads folder:", err);
  }
}

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
