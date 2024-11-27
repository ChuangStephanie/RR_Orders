const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const unzipper = require('unzipper');
const pdfkit = require('pdfkit');
const app = express();

// upload path
const upload = multer({ dest: path.join(__dirname, 'db', 'uploads') });

app.post('/api/upload', upload.fields([{ name: 'excel' }, { name: 'zip' }]), async (req, res) => {
  try {
    // read excel file
    const excelFilePath = req.files.excel[0].path;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelFilePath);

    // sheet name from the request
    const sheetName = req.body.sheetName;
    const sheet = workbook.getWorksheet(sheetName);

    if (!sheet) {
      return res.status(404).json({ message: `Sheet "${sheetName}" not found in the Excel file.` });
    }

    // find columns by name
    let orderNumberColumnIndex = -1;
    let modelColumnIndex = -1;

    // find col index by header
    sheet.getRow(1).eachCell((cell, colNumber) => {
      const header = (cell.value || '').toString().toLowerCase();

      if (header.includes('platform order number')) {
        orderNumberColumnIndex = colNumber;
      }
      if (header.includes('suitable model')) {
        modelColumnIndex = colNumber;
      }
    });

    if (orderNumberColumnIndex === -1 || modelColumnIndex === -1) {
      return res.status(400).json({ message: 'Could not find required columns: "Platform Order Number" or "Suitable Model" in the sheet.' });
    }

    // process data from sheet
    const rows = sheet.getRows(2, sheet.rowCount); // Skip the header row
    const labels = {}; // Object to hold grouped labels by model

    // group by model
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

    // process zip file
    const zipFilePath = req.files.zip[0].path;
    const extractPath = path.join(__dirname, 'db', 'uploads', 'labels'); // Extract path updated
    fs.mkdirSync(extractPath, { recursive: true });

    // Extract zip
    const unzipStream = fs.createReadStream(zipFilePath).pipe(unzipper.Extract({ path: extractPath }));
    unzipStream.on('close', async () => {

      const modelPdfs = await generateModelPdfs(labels, extractPath);

      // clean up
      fs.unlinkSync(excelFilePath);
      fs.unlinkSync(zipFilePath);

      // response
      res.json({
        message: 'Labels sorted and combined into PDFs by model.',
        downloadLinks: modelPdfs
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'An error occurred while processing the request.' });
  }
});

// generate a PDF for each model
async function generateModelPdfs(labels, extractPath) {
  const modelPdfs = [];

  for (const model in labels) {
    const modelLabelPaths = labels[model].map((orderNumber) => {

      return fs.readdirSync(extractPath).find(file =>
        file.toLowerCase().includes(orderNumber.toString().toLowerCase()) && file.endsWith('.pdf')
      );
    }).filter(Boolean);

    const modelPdfPath = path.join(extractPath, `${model}_combined.pdf`);
    const doc = new pdfkit();

    const writeStream = fs.createWriteStream(modelPdfPath);
    doc.pipe(writeStream);

    for (const labelPath of modelLabelPaths) {
      if (fs.existsSync(path.join(extractPath, labelPath))) {
        doc.addPage();
        doc.image(path.join(extractPath, labelPath), { fit: [500, 500], align: 'center', valign: 'center' });
      }
    }

    doc.end();

    // Wait for the PDF to be written before continuing
    await new Promise((resolve) => writeStream.on('finish', resolve));

    modelPdfs.push(`/db/uploads/labels/${model}_combined.pdf`);
  }

  return modelPdfs;
}

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
