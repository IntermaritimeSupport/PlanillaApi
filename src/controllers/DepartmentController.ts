import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';

export class DepartmentController {

    /**
     * Creates a new department.
     * @param req Express Request. Expects { name, description?, companyId, isActive? } in the body.
     * @param res Express Response.
     */
    async Create(req: Request, res: Response) {
        try {
            const { name, description, companyId, isActive } = req.body;

            // Validate that name and companyId are provided
            if (!name || !companyId) {
                return res.status(400).json({ error: 'El nombre del departamento y el ID de la compañía son obligatorios.' });
            }

            // Optional: Check if the company exists before creating the department
            const existingCompany = await prisma.company.findUnique({
                where: { id: companyId }
            });

            if (!existingCompany) {
                return res.status(404).json({ error: 'La compañía especificada no existe.' });
            }

            const newDepartment = await prisma.department.create({
                data: {
                    name,
                    description,
                    isActive: isActive !== undefined ? isActive : true, // Default to true if not provided
                    company: {
                        connect: { id: companyId }, // Connect to the existing company
                    },
                },
                include: {
                    company: true, // Include the associated company in the response
                },
            });

            res.status(201).json(newDepartment); // 201 Created
        } catch (error: any) {
            console.error('Error creating department:', error);
            if (error.code === 'P2002') {
                // Unique constraint violation (e.g., if department name should be unique per company)
                let errorMessage = 'Ya existe un departamento con este nombre en esta compañía.';
                if (error.meta?.target) {
                     if (error.meta.target.includes('name') && error.meta.target.includes('companyId')) {
                        errorMessage = 'Ya existe un departamento con el mismo nombre para esta compañía.';
                     } else if (error.meta.target.includes('name')) {
                        errorMessage = 'Ya existe un departamento con este nombre.';
                     }
                }
                return res.status(409).json({ error: errorMessage });
            }
            if (error.code === 'P2025') { // Foreign key constraint error if companyId is invalid
                return res.status(400).json({ error: 'Error al conectar el departamento a la compañía. Asegúrate de que el companyId sea válido.' });
            }
            res.status(500).json({ error: 'Internal server error while creating department.', details: error.message });
        }
    }

    /**
     * Deletes a department by its ID.
     * Note: Depending on your Prisma schema's onDelete settings for the 'Person' model's
     * department relation, persons associated with this department might need to be
     * handled (e.g., set their departmentId to null) before deletion.
     * If onDelete is 'Restrict' or 'NoAction' and persons are still linked, this will fail.
     * @param req Express Request. Expects the department ID in req.params.
     * @param res Express Response.
     */
    async Delete(req: Request, res: Response) {
        try {
            const { id } = req.params;

            const department = await prisma.department.findUnique({
                where: { id },
            });

            if (!department) {
                return res.status(404).json({ error: 'Departamento no encontrado.' });
            }

            // Antes de eliminar el departamento, setea a null el departmentId de todas las personas asociadas.
            // Esto es crucial si tu relación Person.department no tiene onDelete: Cascade.
            await prisma.person.updateMany({
                where: { departmentId: id },
                data: { departmentId: null },
            });

            await prisma.department.delete({
                where: { id },
            });

            res.status(204).send(); // 204 No Content for successful deletion
        } catch (error: any) {
            console.error('Error deleting department:', error);
            if (error.code === 'P2025') {
                return res.status(404).json({ error: 'Departamento no encontrado para eliminar.' });
            }
            if (error.code === 'P2003') { // Foreign key constraint violation if persons are still linked and onDelete is restrictive
                return res.status(409).json({ error: 'No se puede eliminar el departamento porque aún tiene personas asociadas. Desasocie las personas primero.' });
            }
            res.status(500).json({ error: 'Internal server error while deleting department.', details: error.message });
        }
    }

    /**
     * Edits an existing department by its ID.
     * @param req Express Request. Expects the ID in req.params and the data to update in req.body.
     * @param res Express Response.
     */
    async Edit(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { name, description, isActive, companyId } = req.body;

            // Prepare data for update
            const departmentData: any = {
                name,
                description,
                isActive,
            };

            // If companyId is provided, attempt to connect to a new company
            if (companyId !== undefined) {
                const existingCompany = await prisma.company.findUnique({
                    where: { id: companyId }
                });

                if (!existingCompany) {
                    return res.status(404).json({ error: 'La compañía especificada para actualizar no existe.' });
                }
                departmentData.company = {
                    connect: { id: companyId }
                };
            }

            const updatedDepartment = await prisma.department.update({
                where: { id },
                data: departmentData,
                include: {
                    company: true, // Include the associated company in the response
                },
            });

            res.json(updatedDepartment);
        } catch (error: any) {
            console.error('Error editing department:', error);
            if (error.code === 'P2025') { // Record not found
                return res.status(404).json({ error: 'Departamento no encontrado para actualizar.' });
            }
            if (error.code === 'P2002') { // Unique constraint violation
                let errorMessage = 'Ya existe un departamento con el nombre proporcionado en esta compañía.';
                if (error.meta?.target) {
                     if (error.meta.target.includes('name') && error.meta.target.includes('companyId')) {
                        errorMessage = 'Ya existe un departamento con el mismo nombre para esta compañía.';
                     } else if (error.meta.target.includes('name')) {
                        errorMessage = 'Ya existe un departamento con este nombre.';
                     }
                }
                return res.status(409).json({ error: errorMessage });
            }
            res.status(500).json({ error: 'Internal server error while editing department.', details: error.message });
        }
    }

    /**
     * Gets a department by its ID.
     * Includes the associated company and a selection of associated persons.
     * @param req Express Request. Expects the department ID in req.params.
     * @param res Express Response.
     */
    async get(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const department = await prisma.department.findUnique({
                where: { id },
                include: {
                    company: true, // Include the associated company details
                    persons: { // Include persons associated with this department
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            fullName: true,
                            userCode: true,
                            position: true,
                        }
                    },
                }
            });

            if (!department) {
                return res.status(404).json({ error: 'Departamento no encontrado.' });
            }
            res.json(department);
        } catch (error) {
            console.error('Error fetching department:', error);
            res.status(500).json({ error: 'Internal server error while fetching department.' });
        }
    }

    /**
     * Gets all departments.
     * Includes the associated company and a count of associated persons.
     * @param req Express Request.
     * @param res Express Response.
     */
    async getAll(req: Request, res: Response) {
        try {
            const departments = await prisma.department.findMany({
                include: {
                    company: true, // Include the associated company details for each department
                    _count: { // Include count of persons in each department
                        select: {
                            persons: true,
                        }
                    }
                }
            });
            res.json(departments);
        } catch (error) {
            console.error('Error fetching all departments:', error);
            res.status(500).json({ error: 'Internal server error while fetching departments.' });
        }
    }
}