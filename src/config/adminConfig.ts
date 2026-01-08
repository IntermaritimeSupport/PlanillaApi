import 'dotenv/config';
export const AdminConfig = {
  Email: process.env.ADMIN_EMAIL,
  Password: process.env.ADMIN_EMAIL_PASSWORD,
  Name: process.env.ADMIN_NAME,
  LastName: process.env.ADMIN_LAST_NAME,
};
