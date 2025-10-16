const nodemailer = require("nodemailer");
const handlebars = require("handlebars");
const nodemailerHandlebars = require("nodemailer-express-handlebars");
const fs = require("fs");

// Read the HTML template
const templateSource = fs.readFileSync(
  "src/views/emailTemplate.handlebars",
  "utf-8"
);

// Compile the template
const template = handlebars.compile(templateSource);

// Create a transporter
const transporter = nodemailer.createTransport({
  host: "budjlite.com",
  port: 465,
  secure: true,
  auth: {
    user: "hello@budjlite.com",
    pass: "W3Cre#+eGREAt5tuff=",
  },
});

// Register Handlebars as the template engine for Nodemailer
transporter.use(
  "compile",
  nodemailerHandlebars({
    viewEngine: {
      layoutsDir: "src/views", // Set your layouts directory if needed
      defaultLayout: "emailTemplate", // Set the default layout file
    },
    viewPath: "src/views", // Set your views directory
    extName: ".handlebars",
  })
);

// Define email options with dynamic data
// const mailOptions = {
//   from: 'your-email@example.com',
//   to: 'recipient@example.com',
//   subject: 'Handlebars Email Template',
//   template: 'emailTemplate', // Use the name of your template file without the extension
//   context: {
//     greeting: 'Hello!',
//     message: 'This is a sample email using Handlebars templating.',
//     // You can add more dynamic data here
//   },
// };

// Send email
const sendEmail = ({
  from = "hello@budjlite.com",
  to,
  subject,
  template = "emailTemplate",
  context,
}) => {
  const { firstname, message, otp } = context;
  transporter.sendMail(
    { from, to, subject, template, context },
    (error, info) => {
      if (error) {
        return console.error(error.message);
      }
      console.log("Email sent: " + info.response);
    }
  );
};

module.exports = sendEmail;
