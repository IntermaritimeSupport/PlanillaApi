// src/companies/company.controller.ts
import { NextFunction, Request, Response } from 'express';
import { generateNextCompanyCode } from '../utils/companyCodeGenerator.js';
import prisma from '../../lib/prisma.js';

export class CompanyController {

 async Create(req: Request, res: Response) {
        try {
            const { name, address, phone, email, ruc, logoUrl, createdByUserId } = req.body;

            // 1. Validación básica
            if (!name) {
                return res.status(400).json({ error: 'El nombre de la compañía es obligatorio.' });
            }

            // 2. Generar el código de la compañía (fuera de la transacción para evitar bloqueos largos)
            const companyCode = await generateNextCompanyCode(prisma);

            // 3. Ejecutar Transacción Atómica
            const newCompany = await prisma.$transaction(async (tx) => {
                
                // A. Crear la compañía
                const company = await tx.company.create({
                    data: {
                        name,
                        code: companyCode,
                        address,
                        phone,
                        email,
                        ruc,
                        logoUrl,
                        isActive: true,
                        ...(createdByUserId && {
                            createdBy: {
                                connect: { id: createdByUserId },
                            },
                        }),
                    },
                });

                // B. Definir parámetros legales por defecto (Panamá 2026)
                // Usamos el ID de la compañía recién creada
                const legalParametersData = [
                    {
                        key: 'ss_empleado',
                        name: 'Seguro Social - Empleado',
                        type: 'employee',
                        category: 'social_security',
                        percentage: 9.75,
                        companyId: company.id,
                        status: 'active',
                        effectiveDate: new Date(),
                        description: 'Cuota regular de SS para empleados',
                    },
                    {
                        key: 'ss_patrono',
                        name: 'Seguro Social - Patrono',
                        type: 'employer',
                        category: 'social_security',
                        percentage: 12.25,
                        companyId: company.id,
                        status: 'active',
                        effectiveDate: new Date(),
                        description: 'Cuota patronal de SS',
                    },
                    {
                        key: 'ss_decimo',
                        name: 'Seguro Social - XIII Mes',
                        type: 'employee',
                        category: 'social_security',
                        percentage: 7.25,
                        companyId: company.id,
                        status: 'active',
                        effectiveDate: new Date(),
                        description: 'Cuota de SS para el décimo tercer mes',
                    },
                    {
                        key: 'se_empleado',
                        name: 'Seguro Educativo - Empleado',
                        type: 'employee',
                        category: 'educational_insurance',
                        percentage: 1.25,
                        companyId: company.id,
                        status: 'active',
                        effectiveDate: new Date(),
                        description: 'Seguro educativo empleado',
                    },
                    {
                        key: 'se_patrono',
                        name: 'Seguro Educativo - Patrono',
                        type: 'employer',
                        category: 'educational_insurance',
                        percentage: 1.50,
                        companyId: company.id,
                        status: 'active',
                        effectiveDate: new Date(),
                        description: 'Seguro educativo patronal',
                    },
                    {
                        key: 'riesgo_profesional',
                        name: 'Riesgos Profesionales',
                        type: 'employer',
                        category: 'other',
                        percentage: 0.98,
                        companyId: company.id,
                        status: 'active',
                        effectiveDate: new Date(),
                        description: 'Riesgos profesionales base',
                    },
                    {
                        key: 'isr_r1',
                        name: 'ISR Tramo 1 (Exento)',
                        type: 'fixed',
                        category: 'isr',
                        percentage: 0,
                        minRange: 0,
                        maxRange: 11000,
                        companyId: company.id,
                        status: 'active',
                        effectiveDate: new Date(),
                        description: 'Rango exento hasta $11,000 anuales',
                    },
                    {
                        key: 'isr_r2',
                        name: 'ISR Tramo 2 (15%)',
                        type: 'fixed',
                        category: 'isr',
                        percentage: 15,
                        minRange: 11001,
                        maxRange: 50000,
                        companyId: company.id,
                        status: 'active',
                        effectiveDate: new Date(),
                        description: '15% sobre excedente de $11k a $50k',
                    },
                    {
                        key: 'isr_r3',
                        name: 'ISR Tramo 3 (25%)',
                        type: 'fixed',
                        category: 'isr',
                        percentage: 25,
                        minRange: 50001,
                        maxRange: 99999999,
                        companyId: company.id,
                        status: 'active',
                        effectiveDate: new Date(),
                        description: '25% sobre excedente de $50k',
                    },
                ];

                // C. Insertar todos los parámetros de golpe
                // Nota: usamos el nombre del modelo tal como está en tu schema.prisma
                await tx.legalParameter.createMany({
                    data: legalParametersData as any,
                });
                await tx.legalDecimoParameter.createMany({
                    data: legalParametersData as any,
                });

                return company;
            });

            // 4. Respuesta exitosa
            res.status(201).json(newCompany);

        } catch (error: any) {
            console.error('Error al crear la compañía:', error);

            // Manejo de errores de Prisma (P2002 es para campos únicos)
            if (error.code === 'P2002') {
                let errorMessage = 'Ya existe una compañía con este nombre o código.';
                if (error.meta?.target) {
                    if (error.meta.target.includes('name')) errorMessage = 'El nombre de la compañía ya existe.';
                    if (error.meta.target.includes('code')) errorMessage = 'El código de la compañía ya existe.';
                    if (error.meta.target.includes('ruc')) errorMessage = 'El RUC de la compañía ya existe.';
                }
                return res.status(409).json({ error: errorMessage });
            }

            res.status(500).json({ 
                error: 'Error interno del servidor al crear la compañía.',
                details: error.message 
            });
        }
    }

    /**
     * Deletes a company and all its related data
     * UserCompany relations are automatically deleted (CASCADE)
     * @param req Express Request with company ID in params
     * @param res Express Response
     */
    async Delete(req: Request, res: Response) {
        try {
            const { id } = req.params;

            // Verify company exists
            const company = await prisma.company.findUnique({
                where: { id },
                include: {
                    users: {
                        include: {
                            user: {
                                select: { id: true, username: true },
                            },
                        },
                    },
                },
            });

            if (!company) {
                return res.status(404).json({ error: 'Compañía no encontrada.' });
            }

            // Log which users will be disassociated
            console.log(
                `Eliminando compañía "${company.name}" (${company.code}). ` +
                `${company.users.length} relación(es) usuario-compañía serán eliminada(s).`
            );

            // Delete the company
            // Due to the cascade configuration in schema.prisma:
            // - Departments, Equipment, Licenses, Maintenances, Documents, Networks, NetworkProviders will be DELETED
            // - UserCompany relations will be DELETED (CASCADE)
            await prisma.company.delete({
                where: { id },
            });

            res.status(200).json({
                message: 'Compañía eliminada correctamente',
                deletedCompany: {
                    id: company.id,
                    name: company.name,
                    code: company.code,
                },
                userRelationsDeleted: company.users.length,
                usersDetails: company.users.map(uc => ({
                    id: uc.user.id,
                    username: uc.user.username,
                    status: 'Relación eliminada',
                })),
            });
        } catch (error: any) {
            console.error('Error al eliminar la compañía:', error);
            if (error.code === 'P2025') {
                return res.status(404).json({ error: 'Compañía no encontrada.' });
            }
            res.status(500).json({ error: 'Error interno del servidor al eliminar la compañía.' });
        }
    }

    /**
     * Updates an existing company
     * @param req Express Request with company ID in params and update data in body
     * @param res Express Response
     */
    async Edit(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const { name, address, phone, email, ruc, logoUrl, isActive, createdByUserId } = req.body;

            const updatedCompany = await prisma.company.update({
                where: { id },
                data: {
                    name,
                    address,
                    phone,
                    email,
                    ruc,
                    logoUrl,
                    isActive,
                    ...(createdByUserId && {
                        createdBy: {
                            connect: { id: createdByUserId },
                        },
                    }),
                },
            });

            res.json(updatedCompany);
        } catch (error: any) {
            console.error('Error al editar la compañía:', error);
            if (error.code === 'P2025') {
                return res.status(404).json({ error: 'Compañía no encontrada para actualizar.' });
            }
            if (error.code === 'P2002') {
                let errorMessage = 'Ya existe una compañía con el nombre, código o RUC proporcionado.';
                if (error.meta?.target) {
                    if (error.meta.target.includes('name')) errorMessage = 'El nombre de la compañía ya existe.';
                    if (error.meta.target.includes('code')) errorMessage = 'El código de la compañía ya existe.';
                    if (error.meta.target.includes('ruc')) errorMessage = 'El RUC de la compañía ya existe.';
                }
                return res.status(409).json({ error: errorMessage });
            }
            res.status(500).json({ error: 'Error interno del servidor al editar la compañía.' });
            next(error);
        }
    }

    /**
     * Gets a single company with all its relations
     * @param req Express Request with company ID in params
     * @param res Express Response
     */
    async get(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;

            const company = await prisma.company.findUnique({
                where: { id },
                include: {
                    users: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    username: true,
                                    email: true,
                                    person: {
                                        select: {
                                            fullName: true,
                                            position: true,
                                        }
                                    }
                                }
                            }
                        }
                    },
                    departments: {
                        select: {
                            id: true,
                            name: true,
                            description: true,
                            isActive: true,
                        }
                    },
                }
            });

            if (!company) {
                return res.status(404).json({ error: 'Compañía no encontrada.' });
            }

            res.json(company);
        } catch (error: any) {
            console.error('Error al obtener la compañía:', error);
            res.status(500).json({ error: 'Error interno del servidor al obtener la compañía.' });
            next(error);
        }
    }

    /**
     * Gets all companies with counts of related records
     * Filters based on user role:
     * - SUPER_ADMIN: sees all companies
     * - ADMIN: sees only their company
     * @param req Express Request with optional user context
     * @param res Express Response
     */
    async getAll(req: Request, res: Response, next: NextFunction) {
        try {
            const companies = await prisma.company.findMany({
                include: {
                    _count: {
                        select: {
                            users: true,
                        }
                    },
                    departments: {
                        select: {
                            id: true,
                            name: true,
                            description: true,
                            isActive: true,
                        },
                        where: { isActive: true },
                    },
                },
                orderBy: {
                    name: 'asc',
                }
            });
            res.json(companies);
        } catch (error: any) {
            console.error('Error al obtener las compañías:', error);
            res.status(500).json({ error: 'Error interno del servidor al obtener las compañías.' });
            next(error);
        }
    }

    /**
     * Gets companies filtered by user role
     * SUPER_ADMIN: sees all companies
     * ADMIN/USER: sees only their companies
     * @param req Express Request with authenticated user
     * @param res Express Response
     */
    async getMyCompanies(req: Request, res: Response, next: NextFunction) {
        try {
            const { userId } = req.params

            if (!userId) {
                return res.status(400).json({ error: 'ID de usuario es requerido.' })
            }

            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { 
                    id: true, 
                    role: true,
                    companies: {
                        select: {
                            companyId: true,
                        }
                    }
                },
            })

            if (!user) {
                return res.status(404).json({ error: 'Usuario no encontrado.' })
            }

            let companies = []

            // 🔥 SUPER ADMIN → TODAS las compañías
            if (user.role === 'SUPER_ADMIN') {
                companies = await prisma.company.findMany({
                    include: {
                        _count: {
                            select: {
                                users: true,
                            },
                        },
                    },
                    orderBy: { name: 'asc' },
                })
            } 
            // 👤 OTROS ROLES → SOLO sus compañías asociadas
            else {
                if (user.companies.length === 0) {
                    return res.status(200).json([])
                }

                const companyIds = user.companies.map(uc => uc.companyId)

                companies = await prisma.company.findMany({
                    where: { 
                        id: { 
                            in: companyIds 
                        } 
                    },
                    include: {
                        _count: {
                            select: {
                                users: true,
                            },
                        },
                    },
                    orderBy: { name: 'asc' },
                })
            }

            return res.json(companies)
        } catch (error) {
            console.error('Error al obtener compañías del usuario:', error)
            next(error)
        }
    }

    /**
     * Gets all departments of a company by company code
     * @param req Express Request with company code in params
     * @param res Express Response
     */
    async getDepartmentsByCompanyCode(req: Request, res: Response) {
        try {
            const { companyCode } = req.params;

            console.log('getDepartmentsByCompanyCode - Params recibidos:', req.params);
            console.log('companyCode:', companyCode);

            if (!companyCode) {
                return res.status(400).json({ error: 'El código de la compañía es obligatorio.' });
            }

            const company = await prisma.company.findUnique({
                where: { code: companyCode },
                include: {
                    departments: {
                        select: {
                            id: true,
                            name: true,
                            description: true,
                            isActive: true,
                            createdAt: true,
                            updatedAt: true,
                        },
                        orderBy: { name: 'asc' },
                    },
                },
            });

            if (!company) {
                console.log(`Compañía con código '${companyCode}' no encontrada`);
                return res.status(404).json({
                    error: `Compañía con código '${companyCode}' no encontrada.`,
                    receivedCode: companyCode,
                });
            }

            if (company.departments.length === 0) {
                console.log(`Compañía '${companyCode}' no tiene departamentos`);
                return res.status(404).json({
                    error: `Compañía con código '${companyCode}' no tiene departamentos.`
                });
            }

            res.status(200).json(company.departments);

        } catch (error: any) {
            console.error('Error fetching departments by company code:', error);
            res.status(500).json({
                error: 'Error interno del servidor al obtener los departamentos de la compañía.',
                details: error.message
            });
        }
    }

    /**
     * Disassociate users from a company (delete UserCompany relations)
     * Useful when you want to remove users without deleting the company
     * @param req Express Request with company ID in params and userIds in body
     * @param res Express Response
     */
    async disassociateUsers(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const { userIds } = req.body;

            if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
                return res.status(400).json({ error: 'Se requiere un array de IDs de usuarios.' });
            }

            // Verify company exists
            const company = await prisma.company.findUnique({
                where: { id },
            });

            if (!company) {
                return res.status(404).json({ error: 'Compañía no encontrada.' });
            }

            // Delete UserCompany relations
            const deletedRelations = await prisma.userCompany.deleteMany({
                where: {
                    companyId: id,
                    userId: { in: userIds },
                },
            });

            res.json({
                message: 'Usuarios desasociados correctamente',
                deletedCount: deletedRelations.count,
                companyId: id,
            });
        } catch (error: any) {
            console.error('Error al desasociar usuarios:', error);
            res.status(500).json({ error: 'Error interno del servidor al desasociar usuarios.' });
            next(error);
        }
    }

    /**
     * Associate users to a company (create UserCompany relations)
     * @param req Express Request with company ID in params and userIds in body
     * @param res Express Response
     */
    async associateUsers(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const { userIds } = req.body;

            if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
                return res.status(400).json({ error: 'Se requiere un array de IDs de usuarios.' });
            }

            // Verify company exists
            const company = await prisma.company.findUnique({
                where: { id },
            });

            if (!company) {
                return res.status(404).json({ error: 'Compañía no encontrada.' });
            }

            // Create UserCompany relations (skip duplicates)
            const createdRelations = await prisma.$transaction(
                userIds.map(userId =>
                    prisma.userCompany.upsert({
                        where: {
                            userId_companyId: {
                                userId,
                                companyId: id,
                            },
                        },
                        update: {},
                        create: {
                            userId,
                            companyId: id,
                        },
                    })
                )
            );

            res.json({
                message: 'Usuarios asociados correctamente',
                createdCount: createdRelations.length,
                companyId: id,
            });
        } catch (error: any) {
            console.error('Error al asociar usuarios:', error);
            res.status(500).json({ error: 'Error interno del servidor al asociar usuarios.' });
            next(error);
        }
    }
}