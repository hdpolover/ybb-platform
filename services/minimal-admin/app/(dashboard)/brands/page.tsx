"use client";

import { useState } from "react";
import { Button } from "@/app/components/ui/Button";
import { Card, CardContent } from "@/app/components/ui/Card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/Table";
import { PlusIcon, PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Modal } from "@/app/components/ui/Modal";
import { Label } from "@/app/components/ui/Label";
import { Input } from "@/app/components/ui/Input";

type Brand = {
    id: number;
    name: string;
    code: string;
    programs: number;
    status: string;
};

const initialBrands: Brand[] = [
    { id: 1, name: "Istanbul Youth Summit", code: "IYS", programs: 3, status: "Active" },
    { id: 2, name: "Japan Youth Summit", code: "JYS", programs: 2, status: "Active" },
    { id: 3, name: "Korea Youth Summit", code: "KYS", programs: 2, status: "Active" },
];

export default function BrandsPage() {
    const [brands, setBrands] = useState<Brand[]>(initialBrands);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentBrand, setCurrentBrand] = useState<Partial<Brand>>({});

    const handleOpenModal = (brand?: Brand) => {
        if (brand) {
            setCurrentBrand(brand);
        } else {
            setCurrentBrand({ status: "Active", programs: 0 });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setCurrentBrand({});
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (currentBrand.id) {
            // Update
            setBrands(brands.map((b) => (b.id === currentBrand.id ? { ...b, ...currentBrand } as Brand : b)));
        } else {
            // Create
            const newBrand = {
                ...currentBrand,
                id: Math.max(0, ...brands.map((b) => b.id)) + 1,
                programs: 0,
                status: "Active",
            } as Brand;
            setBrands([...brands, newBrand]);
        }
        handleCloseModal();
    };

    const handleDelete = (id: number) => {
        if (confirm("Are you sure you want to delete this brand?")) {
            setBrands(brands.filter((b) => b.id !== id));
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">Brands</h1>
                    <p className="text-sm text-zinc-500">Manage program brands and categories</p>
                </div>
                <Button onClick={() => handleOpenModal()}>
                    <PlusIcon className="mr-2 h-4 w-4" />
                    Add Brand
                </Button>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Brand Name</TableHead>
                                <TableHead>Code</TableHead>
                                <TableHead>Active Programs</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {brands.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-zinc-500">
                                        No brands found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                brands.map((brand) => (
                                    <TableRow key={brand.id}>
                                        <TableCell className="font-medium">{brand.name}</TableCell>
                                        <TableCell>{brand.code}</TableCell>
                                        <TableCell>{brand.programs}</TableCell>
                                        <TableCell>
                                            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                                                {brand.status}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right space-x-2">
                                            <Button variant="ghost" size="sm" onClick={() => handleOpenModal(brand)}>
                                                <PencilSquareIcon className="h-4 w-4" />
                                            </Button>
                                            <Button variant="danger" size="sm" className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 shadow-none" onClick={() => handleDelete(brand.id)}>
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
                title={currentBrand.id ? "Edit Brand" : "Add Brand"}
            >
                <form onSubmit={handleSave} className="space-y-4 mt-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Brand Name</Label>
                        <Input
                            id="name"
                            value={currentBrand.name || ""}
                            onChange={(e) => setCurrentBrand({ ...currentBrand, name: e.target.value })}
                            placeholder="e.g. Istanbul Youth Summit"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="code">Brand Code</Label>
                        <Input
                            id="code"
                            value={currentBrand.code || ""}
                            onChange={(e) => setCurrentBrand({ ...currentBrand, code: e.target.value })}
                            placeholder="e.g. IYS"
                            required
                        />
                    </div>
                    <div className="flex justify-end space-x-2 pt-4">
                        <Button type="button" variant="ghost" onClick={handleCloseModal}>
                            Cancel
                        </Button>
                        <Button type="submit">
                            Save Brand
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
