"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/Card";
import { UsersIcon, BuildingStorefrontIcon, RectangleStackIcon } from "@heroicons/react/24/outline";

const stats = [
    { name: 'Total Users', value: '12', icon: UsersIcon, change: '+12%', changeType: 'increase' },
    { name: 'Active Programs', value: '3', icon: RectangleStackIcon, change: '+2', changeType: 'increase' },
    { name: 'Registered Brands', value: '5', icon: BuildingStorefrontIcon, change: '0%', changeType: 'neutral' },
];

export default function DashboardPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-zinc-900">Dashboard</h1>
                <p className="text-sm text-zinc-500">Overview of platform statistics</p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {stats.map((stat) => (
                    <Card key={stat.name}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-zinc-500">
                                {stat.name}
                            </CardTitle>
                            <stat.icon className="h-4 w-4 text-zinc-400" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stat.value}</div>
                            <p className="text-xs text-zinc-500 mt-1">
                                <span className={stat.changeType === 'increase' ? 'text-green-600' : 'text-zinc-500'}>
                                    {stat.change}
                                </span>{' '}
                                from last month
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
