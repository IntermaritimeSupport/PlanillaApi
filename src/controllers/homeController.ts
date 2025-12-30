// src/controllers/homeController.ts
import { Request, Response } from 'express';

const homeController = {
    getIndex: (req: Request, res: Response) => {
        res.render('index', { title: 'Mi Aplicación MVC', message: '¡Bienvenido a la página de inicio!' });
    },
    getAbout: (req: Request, res: Response) => {
        res.render('about', { appName: 'FlowApi MVC' });
    }
};

export default homeController;