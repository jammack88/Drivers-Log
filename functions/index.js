const functions = require("firebase-functions");
const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");
const cors = require("cors")({ origin: true });

// Configure your email (use Gmail App Password or SendGrid)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER, // Your Gmail address
    pass: process.env.EMAIL_PASSWORD, // Gmail App Password (not your regular password)
  },
});

// Function to generate PDF from form data
function generatePDF(formData) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const buffers = [];

    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => {
      resolve(Buffer.concat(buffers));
    });
    doc.on("error", reject);

    // Title
    doc.fontSize(20).font("Helvetica-Bold").text("Aurora DVIR", { align: "center" });
    doc.fontSize(12).text("Driver's Vehicle Inspection Report", { align: "center" });
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();

    // Basic Info
    doc.fontSize(11).font("Helvetica-Bold");
    doc.text(`Driver Name: ${formData.driverName || "N/A"}`);
    doc.text(`Email: ${formData.email || "N/A"}`);
    doc.text(`Carrier: ${formData.carrier || "N/A"}`);
    doc.text(`Location: ${formData.location || "N/A"}`);
    doc.text(`Date: ${formData.date || "N/A"}`);
    doc.moveDown();

    // Tractor Info
    doc.fontSize(11).font("Helvetica-Bold").text("Tractor/Truck Information:");
    doc.font("Helvetica").fontSize(10);
    doc.text(`Truck Number: ${formData.tractorNo || "N/A"}`);
    doc.text(`Odometer Begin: ${formData.odometerBegin || "N/A"} miles`);
    doc.text(`Odometer End: ${formData.odometerEnd || "N/A"} miles`);
    doc.moveDown();

    // Trailer Info
    if (formData.trailer1 || formData.trailer2) {
      doc.fontSize(11).font("Helvetica-Bold").text("Trailer Information:");
      doc.font("Helvetica").fontSize(10);
      if (formData.trailer1) doc.text(`Trailer 1: ${formData.trailer1}`);
      if (formData.trailer2) doc.text(`Trailer 2: ${formData.trailer2}`);
      doc.moveDown();
    }

    // Remarks
    if (formData.remarks) {
      doc.fontSize(11).font("Helvetica-Bold").text("Remarks:");
      doc.font("Helvetica").fontSize(10);
      doc.text(formData.remarks, { width: 500, align: "left" });
      doc.moveDown();
    }

    // Footer
    doc.fontSize(9).text("This report was generated electronically.", { align: "center" });
    doc.text(`Generated on: ${new Date().toLocaleString()}`, { align: "center" });

    doc.end();
  });
}

// Cloud Function to handle form submission
exports.submitDVIRReport = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }

    try {
      const formData = req.body;

      // Validate required fields
      if (!formData.driverName || !formData.email) {
        return res.status(400).json({
          error: "Driver name and email are required",
        });
      }

      // Generate PDF
      const pdfBuffer = await generatePDF(formData);

      // Send email with PDF attachment
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: formData.email,
        subject: `Aurora DVIR Report - ${formData.driverName} - ${formData.date}`,
        html: `
          <h2>Aurora DVIR Report</h2>
          <p>Hello ${formData.driverName},</p>
          <p>Your Driver Vehicle Inspection Report has been submitted successfully.</p>
          <p><strong>Report Details:</strong></p>
          <ul>
            <li>Date: ${formData.date || "N/A"}</li>
            <li>Location: ${formData.location || "N/A"}</li>
            <li>Truck Number: ${formData.tractorNo || "N/A"}</li>
          </ul>
          <p>The PDF is attached to this email for your records.</p>
          <p>Best regards,<br>Aurora Cooperative</p>
        `,
        attachments: [
          {
            filename: `DVIR_${formData.driverName}_${formData.date}.pdf`,
            content: pdfBuffer,
            contentType: "application/pdf",
          },
        ],
      };

      // Send email
      await transporter.sendMail(mailOptions);

      res.status(200).json({
        success: true,
        message: "Report submitted successfully and email sent!",
      });
    } catch (error) {
      console.error("Error:", error);
      res.status(500).json({
        error: "Failed to submit report: " + error.message,
      });
    }
  });
});
