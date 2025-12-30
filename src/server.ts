// src/server.ts
import express from 'express';
import session from 'express-session';
import dotenv from 'dotenv';
import path from 'path';
import AuthRouter from './routes/AuthRoutes.js';
import expressLayouts from 'express-ejs-layouts';
import flash from 'connect-flash';
import { corsMiddleware } from './middlewares/CorsMiddleware.js';
import UserRouter from './routes/UserRoutes.js';
import CompaniesRouter from './routes/CompaniesRoutes.js';
import { errorMiddleware } from './middlewares/errorHandler.js';
import PayrollRouter from './routes/PayrollRoutes.js';
import SystemRouter from './routes/SystemConfigRoutes.js';
import EmployeeRouter from './routes/EmployeeRoutes.js';
import SeedRouter from './routes/SeedRoutes.js';

dotenv.config({ path: '.env' });

const app = express();
const port = process.env.PORT || 3000;
const __dirname = path.resolve();

app.use(expressLayouts);
app.set('layout', 'layout');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(corsMiddleware);

// ⛔ NO PARSEAR JSON en importación CSV
app.use((req, res, next) => {
  if (req.path.includes("/inventory/import")) return next();
  express.json({ limit: "10mb" })(req, res, next);
});

// ⛔ NO PARSEAR URLENCODED en importación CSV
app.use((req, res, next) => {
  if (req.path.includes("/inventory/import")) return next();
  express.urlencoded({ extended: true })(req, res, next);
});

app.use(session({
  secret: process.env.SESSION_SECRET || 'super_secret_key_for_session',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24
  }
}));

app.use(flash());
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  res.locals.user = req.session.user || null;
  next();
});

app.get('/', (req, res) => {
  res.send('Welcome to IT System')
});

app.use('/api/user/auth', AuthRouter);
app.use('/api/users', UserRouter);
app.use('/api/companies', CompaniesRouter);
app.use('/api/system', SystemRouter);
app.use('/api/payroll', PayrollRouter);
app.use('/api/payroll', EmployeeRouter);
app.use('/api/seed', SeedRouter);
app.use(errorMiddleware);

app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
  console.log(`Página de inicio: http://localhost:${port}`);
});
