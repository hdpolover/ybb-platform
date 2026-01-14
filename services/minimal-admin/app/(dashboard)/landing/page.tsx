"use client";

import { useState } from "react";
import { Button } from "@/app/components/ui/Button";
import { Card, CardContent } from "@/app/components/ui/Card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/Table";
import { PlusIcon, PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Modal } from "@/app/components/ui/Modal";
import { Label } from "@/app/components/ui/Label";
import { Input } from "@/app/components/ui/Input";

type LandingPage = {
    id: number;
    slug: string;
    title: string;
    lastUpdated: string;
    status: string;
};

// Mock data based on landing-page.dto.ts
const initialLandingPages = [
    { id: 1, slug: "home", title: "Home Page", lastUpdated: "2 days ago", status: "Published" },
    { id: 2, slug: "about", title: "About Us", lastUpdated: "1 week ago", status: "Published" },
    { id: 3, slug: "programs", title: "Programs Listing", lastUpdated: "3 days ago", status: "Published" },
];

export default function LandingPageManagement() {
    const [pages, setPages] = useState<LandingPage[]>(initialLandingPages);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState<Partial<LandingPage>>({});

    const handleOpenModal = (page?: LandingPage) => {
        if (page) {
            setCurrentPage(page);
        } else {
            setCurrentPage({ status: "Draft" });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setCurrentPage({});
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        const now = "Just now";
        if (currentPage.id) {
            // Update
            setPages(pages.map((p) => (p.id === currentPage.id ? { ...p, ...currentPage, lastUpdated: now } as LandingPage : p)));
        } else {
            // Create
            const newPage = {
                ...currentPage,
                id: Math.max(0, ...pages.map((p) => p.id)) + 1,
                lastUpdated: now,
            } as LandingPage;
            setPages([...pages, newPage]);
        }
        handleCloseModal();
    };

    const handleDelete = (id: number) => {
        if (confirm("Are you sure you want to delete this page?")) {
            setPages(pages.filter((p) => p.id !== id));
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">Landing Pages</h1>
                    <p className="text-sm text-zinc-500">Manage content for public landing pages</p>
                </div>
                <Button onClick={() => handleOpenModal()}>
                    <PlusIcon className="mr-2 h-4 w-4" />
                    Create Page
                </Button>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Page Title</TableHead>
                                <TableHead>Slug</TableHead>
                                <TableHead>Last Updated</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {pages.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-zinc-500">
                                        No pages found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                pages.map((page) => (
                                    <TableRow key={page.id}>
                                        <TableCell className="font-medium">{page.title}</TableCell>
                                        <TableCell>/{page.slug}</TableCell>
                                        <TableCell>{page.lastUpdated}</TableCell>
                                        <TableCell>
                                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${page.status === 'Published' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                {page.status}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right space-x-2">
                                            <Button variant="ghost" size="sm" onClick={() => handleOpenModal(page)}>
                                                <PencilSquareIcon className="h-4 w-4" />
                                            </Button>
                                            <Button variant="danger" size="sm" className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 shadow-none" onClick={() => handleDelete(page.id)}>
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
                title={currentPage.id ? "Edit Page Metadata" : "Create New Page"}
            >
                <form onSubmit={handleSave} className="space-y-4 mt-4">
                    <div className="space-y-2">
                        <Label htmlFor="title">Page Title</Label>
                        <Input
                            id="title"
                            value={currentPage.title || ""}
                            onChange={(e) => setCurrentPage({ ...currentPage, title: e.target.value })}
                            placeholder="e.g. Terms of Service"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="slug">Slug</Label>
                        <Input
                            id="slug"
                            value={currentPage.slug || ""}
                            onChange={(e) => setCurrentPage({ ...currentPage, slug: e.target.value })}
                            placeholder="e.g. terms"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="status">Status</Label>
                        <select
                            id="status"
                            className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            value={currentPage.status || "Draft"}
                            onChange={(e) => setCurrentPage({ ...currentPage, status: e.target.value })}
                        >
                            <option value="Draft">Draft</option>
                            <option value="Published">Published</option>
                            <option value="Archived">Archived</option>
                        </select>
                    </div>
                    <div className="flex justify-end space-x-2 pt-4">
                        <Button type="button" variant="ghost" onClick={handleCloseModal}>
                            Cancel
                        </Button>
                        <Button type="submit">
                            Save Page
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
