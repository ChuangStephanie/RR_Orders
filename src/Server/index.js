const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const unzipper = require("unzipper");
const archiver = require("archiver");
const app = express();
const { PDFDocument, sum } = require("pdf-lib");

// upload path
const upload = multer({ dest: path.join(__dirname, "db", "uploads") });

const PORT = 3000;

app.use(cors());

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
      let platformColIndex = -1;

      sheet.getRow(1).eachCell((cell, colNumber) => {
        const header = (cell.value || "").toString().toLowerCase();

        if (header.includes("platform order number")) {
          orderNumberColumnIndex = colNumber;
        }
        if (header.includes("suitable model")) {
          modelColumnIndex = colNumber;
        }
        if (header.includes("selling platform")) {
          platformColIndex = colNumber;
        }
      });

      if (
        orderNumberColumnIndex === -1 ||
        modelColumnIndex === -1 ||
        platformColIndex === -1
      ) {
        return res.status(400).json({
          message: "Could not find required columns in the sheet.",
        });
      }

      // Process data from sheet
      const rows = sheet.getRows(2, sheet.rowCount);
      const groups = {
        amazon: {},
        others: {},
      };
      const allOrderNums = [];

      rows.forEach((row) => {
        const orderNumber = row.getCell(orderNumberColumnIndex).value;
        const modelName = row.getCell(modelColumnIndex).value;
        const platformName = row.getCell(platformColIndex).value;

        if (orderNumber && modelName) {
          allOrderNums.push(orderNumber.toString().trim());
          const platform =
            platformName &&
            platformName.toString().toLowerCase().includes("amazon")
              ? groups.amazon
              : groups.others;

          if (!platform[modelName]) {
            platform[modelName] = [];
          }
          platform[modelName].push(orderNumber);
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

      let foundOrderNums = new Set();
      let extraOrderNums = new Set();

      unzipStream.on("close", async () => {
        const archive = archiver("zip", { zlib: { level: 9 } });
        res.setHeader("Content-Type", "application/zip");
        res.setHeader(
          "Content-Disposition",
          'attachment; filename="merged_pdfs.zip"'
        );

        archive.pipe(res);

        async function processGroup(group, groupName) {
          for (const model in group) {
            const modelFiles = [];
            const labelCount = group[model].length;
            const currentDate = new Date().toLocaleDateString();
            console.log("Qty:", labelCount, "Date:", currentDate);

            for (const orderNumber of group[model]) {
              const extractedFiles = fs.readdirSync(extractPath);
              const matchingFiles = extractedFiles.filter((file) =>
                file
                  .toLowerCase()
                  .trim()
                  .includes(orderNumber.toString().trim())
              );

              // console.log("matching:", matchingFiles);

              matchingFiles.forEach((file) => {
                const filePath = path.join(extractPath, file);
                if (fs.existsSync(filePath)) {
                  modelFiles.push(filePath);
                  foundOrderNums.add(orderNumber.toString().trim());
                }
              });

              extractedFiles.forEach((file) => {
                const extractedOrderNum = file.toLowerCase().trim();

                if (
                  !allOrderNums.some((order) =>
                    extractedOrderNum.includes(order.toLowerCase().trim())
                  )
                ) {
                  extraOrderNums.add(extractedOrderNum);
                }
              });
            }

            if (modelFiles.length > 0) {
              const sumFilePath = await genSumPage(model, labelCount, currentDate);
              modelFiles.unshift(sumFilePath);

              const mergedPdfBytes = await mergePdfs(modelFiles);
              archive.append(Buffer.from(mergedPdfBytes), {
                name: `${groupName}_${model}.pdf`,
              });
            }
          }
        }

        async function genSumPage(model, labelCount, date) {
          const pdfDoc = await PDFDocument.create();
          const page = pdfDoc.addPage([600, 400]);

          const fontSize = 20;
          page.drawText(`Model: ${model}`, {
            x: 50,
            y: 300,
            size: fontSize,
          });
          page.drawText(`Labels: ${labelCount}`, {
            x: 50,
            y: 260,
            size: fontSize,
          });
          page.drawText(`Date: ${date}`, {
            x: 50,
            y: 220,
            size: fontSize,
          });

          const pdfBytes = await pdfDoc.save();

          const sumFilePath = path.join(
            __dirname,
            "db",
            "uploads",
            `${model}_summary.pdf`
          );
          fs.writeFileSync(sumFilePath, pdfBytes);

          return sumFilePath;
        }

        await processGroup(groups.amazon, "amazon");
        await processGroup(groups.others, "others");

        archive.finalize();

        // Log missing order numbers
        const missingOrderNumbers = allOrderNums.filter(
          (orderNumber) => !foundOrderNums.has(orderNumber)
        );

        console.log("Missing Order Numbers:", missingOrderNumbers);
        console.log(
          "Extra order numbers in zip (not in sheet):",
          extraOrderNums
        );

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

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = server;
