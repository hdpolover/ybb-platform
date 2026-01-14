"use client";

import { useState } from "react";
import { Button } from "@/app/components/ui/Button";
import { Card, CardContent } from "@/app/components/ui/Card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/Table";
import { PlusIcon, PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Modal } from "@/app/components/ui/Modal";
import { Label } from "@/app/components/ui/Label";
import { Input } from "@/app/components/ui/Input";

type User = {
    id: number;
    name: string;
    email: string;
    role: string;
    joined: string;
};

const initialUsers = [
    { id: 1, name: "Hendra", email: "hendra@example.com", role: "Super Admin", joined: "Jan 1, 2024" },
    { id: 2, name: "John Doe", email: "john@example.com", role: "Program Admin", joined: "Feb 15, 2024" },
    { id: 3, name: "Jane Smith", email: "jane@example.com", role: "User", joined: "Mar 10, 2024" },
];

export default function UsersPage() {
    const [users, setUsers] = useState<User[]>(initialUsers);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState<Partial<User>>({});

    const handleOpenModal = (user?: User) => {
        if (user) {
            setCurrentUser(user);
        } else {
            setCurrentUser({ role: "User", joined: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setCurrentUser({});
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (currentUser.id) {
            // Update
            setUsers(users.map((u) => (u.id === currentUser.id ? { ...u, ...currentUser } as User : u)));
        } else {
            // Create
            const newUser = {
                ...currentUser,
                id: Math.max(0, ...users.map((u) => u.id)) + 1,
            } as User;
            setUsers([...users, newUser]);
        }
        handleCloseModal();
    };

    const handleDelete = (id: number) => {
        if (confirm("Are you sure you want to delete this user?")) {
            setUsers(users.filter((u) => u.id !== id));
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">Users</h1>
                    <p className="text-sm text-zinc-500">Manage platform users and administrators</p>
                </div>
                <Button onClick={() => handleOpenModal()}>
                    <PlusIcon className="mr-2 h-4 w-4" />
                    Invite User
                </Button>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Joined Date</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-zinc-500">
                                        No users found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                users.map((user) => (
                                    <TableRow key={user.id}>
                                        <TableCell className="font-medium">{user.name}</TableCell>
                                        <TableCell>{user.email}</TableCell>
                                        <TableCell>{user.role}</TableCell>
                                        <TableCell>{user.joined}</TableCell>
                                        <TableCell className="text-right space-x-2">
                                            <Button variant="ghost" size="sm" onClick={() => handleOpenModal(user)}>
                                                <PencilSquareIcon className="h-4 w-4" />
                                            </Button>
                                            <Button variant="danger" size="sm" className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 shadow-none" onClick={() => handleDelete(user.id)}>
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
                title={currentUser.id ? "Edit User" : "Invite User"}
            >
                <form onSubmit={handleSave} className="space-y-4 mt-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Name</Label>
                        <Input
                            id="name"
                            value={currentUser.name || ""}
                            onChange={(e) => setCurrentUser({ ...currentUser, name: e.target.value })}
                            placeholder="John Doe"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            value={currentUser.email || ""}
                            onChange={(e) => setCurrentUser({ ...currentUser, email: e.target.value })}
                            placeholder="john@example.com"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="role">Role</Label>
                        <select
                            id="role"
                            className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            value={currentUser.role || "User"}
                            onChange={(e) => setCurrentUser({ ...currentUser, role: e.target.value })}
                        >
                            <option value="User">User</option>
                            <option value="Program Admin">Program Admin</option>
                            <option value="Super Admin">Super Admin</option>
                        </select>
                    </div>
                    <div className="flex justify-end space-x-2 pt-4">
                        <Button type="button" variant="ghost" onClick={handleCloseModal}>
                            Cancel
                        </Button>
                        <Button type="submit">
                            {currentUser.id ? "Save User" : "Send Invite"}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
