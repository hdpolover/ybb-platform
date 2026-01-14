"use client";

import { useState } from "react";
import { Button } from "@/app/components/ui/Button";
import { Card, CardContent } from "@/app/components/ui/Card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/Table";
import { PlusIcon, PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Modal } from "@/app/components/ui/Modal";
import { Label } from "@/app/components/ui/Label";
import { Input } from "@/app/components/ui/Input";

type Program = {
    id: string;
    name: string;
    brand: string;
    date: string;
    status: string;
};

const initialPrograms = [
    { id: "iys-2026", name: "Istanbul Youth Summit 2026", brand: "IYS", date: "Feb 10, 2026", status: "Active" },
    { id: "jys-2026", name: "Japan Youth Summit 2026", brand: "JYS", date: "May 11, 2026", status: "Active" },
    { id: "kys-2026", name: "Korea Youth Summit 2026", brand: "KYS", date: "Aug 05, 2026", status: "Upcoming" },
];

export default function ProgramsPage() {
    const [programs, setPrograms] = useState<Program[]>(initialPrograms);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentProgram, setCurrentProgram] = useState<Partial<Program>>({});

    const handleOpenModal = (program?: Program) => {
        if (program) {
            setCurrentProgram(program);
        } else {
            setCurrentProgram({ status: "Draft" });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setCurrentProgram({});
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (currentProgram.id && programs.some(p => p.id === currentProgram.id)) {
            // Update
            setPrograms(programs.map((p) => (p.id === currentProgram.id ? { ...p, ...currentProgram } as Program : p)));
        } else {
            // Create
            const newProgram = {
                ...currentProgram,
                id: currentProgram.id || currentProgram.name?.toLowerCase().replace(/\s+/g, '-') || `program-${Date.now()}`,
            } as Program;
            setPrograms([...programs, newProgram]);
        }
        handleCloseModal();
    };

    const handleDelete = (id: string) => {
        if (confirm("Are you sure you want to delete this program?")) {
            setPrograms(programs.filter((p) => p.id !== id));
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">Programs</h1>
                    <p className="text-sm text-zinc-500">Manage upcoming and past programs</p>
                </div>
                <Button onClick={() => handleOpenModal()}>
                    <PlusIcon className="mr-2 h-4 w-4" />
                    Create Program
                </Button>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Program Name</TableHead>
                                <TableHead>Brand</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {programs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-zinc-500">
                                        No programs found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                programs.map((program) => (
                                    <TableRow key={program.id}>
                                        <TableCell className="font-medium">{program.name}</TableCell>
                                        <TableCell>{program.brand}</TableCell>
                                        <TableCell>{program.date}</TableCell>
                                        <TableCell>
                                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${program.status === 'Active' ? 'bg-green-100 text-green-800' :
                                                program.status === 'Upcoming' ? 'bg-blue-100 text-blue-800' :
                                                    'bg-zinc-100 text-zinc-800'
                                                }`}>
                                                {program.status}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right space-x-2">
                                            <Button variant="ghost" size="sm" onClick={() => handleOpenModal(program)}>
                                                <PencilSquareIcon className="h-4 w-4" />
                                            </Button>
                                            <Button variant="danger" size="sm" className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 shadow-none" onClick={() => handleDelete(program.id)}>
                                                <TrashIcon className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Modal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                title={currentProgram.name ? "Edit Program" : "Create Program"}
            >
                <form onSubmit={handleSave} className="space-y-4 mt-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Program Name</Label>
                        <Input
                            id="name"
                            value={currentProgram.name || ""}
                            onChange={(e) => setCurrentProgram({ ...currentProgram, name: e.target.value })}
                            placeholder="e.g. Istanbul Youth Summit 2026"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="brand">Brand</Label>
                        <select
                            id="brand"
                            className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            value={currentProgram.brand || ""}
                            onChange={(e) => setCurrentProgram({ ...currentProgram, brand: e.target.value })}
                            required
                        >
                            <option value="" disabled>Select Brand</option>
                            <option value="IYS">Istanbul Youth Summit (IYS)</option>
                            <option value="JYS">Japan Youth Summit (JYS)</option>
                            <option value="KYS">Korea Youth Summit (KYS)</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="date">Date</Label>
                        <Input
                            id="date"
                            value={currentProgram.date || ""}
                            onChange={(e) => setCurrentProgram({ ...currentProgram, date: e.target.value })}
                            placeholder="e.g. Feb 10, 2026"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="status">Status</Label>
                        <select
                            id="status"
                            className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            value={currentProgram.status || "Draft"}
                            onChange={(e) => setCurrentProgram({ ...currentProgram, status: e.target.value })}
                        >
                            <option value="Draft">Draft</option>
                            <option value="Upcoming">Upcoming</option>
                            <option value="Active">Active</option>
                            <option value="Completed">Completed</option>
                        </select>
                    </div>
                    <div className="flex justify-end space-x-2 pt-4">
                        <Button type="button" variant="ghost" onClick={handleCloseModal}>
                            Cancel
                        </Button>
                        <Button type="submit">
                            Save Program
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
