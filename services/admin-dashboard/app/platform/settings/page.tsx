"use client";

import { Cog6ToothIcon, ShieldCheckIcon, EnvelopeIcon, CreditCardIcon } from "@heroicons/react/24/outline";

export default function SettingsPage() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Platform Settings</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Configure platform-wide settings and preferences
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-600">Active Settings</p>
              <p className="mt-1 text-2xl font-bold text-zinc-900">24</p>
              <p className="mt-1 text-[10px] text-zinc-600">Configured</p>
            </div>
            <div className="rounded-full bg-blue-100 p-2.5">
              <Cog6ToothIcon className="h-5 w-5 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-600">Email Templates</p>
              <p className="mt-1 text-2xl font-bold text-zinc-900">8</p>
              <p className="mt-1 text-[10px] text-emerald-600">Active</p>
            </div>
            <div className="rounded-full bg-emerald-100 p-2.5">
              <EnvelopeIcon className="h-5 w-5 text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-600">Payment Methods</p>
              <p className="mt-1 text-2xl font-bold text-zinc-900">2</p>
              <p className="mt-1 text-[10px] text-zinc-600">Connected</p>
            </div>
            <div className="rounded-full bg-purple-100 p-2.5">
              <CreditCardIcon className="h-5 w-5 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-600">Security Level</p>
              <p className="mt-1 text-2xl font-bold text-zinc-900">High</p>
              <p className="mt-1 text-[10px] text-emerald-600">2FA Enabled</p>
            </div>
            <div className="rounded-full bg-amber-100 p-2.5">
              <ShieldCheckIcon className="h-5 w-5 text-amber-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* General Settings */}
        <div className="rounded-md border border-zinc-200 bg-white px-5 py-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">General Settings</h2>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                Platform Name
              </label>
              <input
                type="text"
                defaultValue="YBB Platform"
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                Support Email
              </label>
              <input
                type="email"
                defaultValue="support@ybb.org"
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                Timezone
              </label>
              <select className="w-full rounded-md border border-zinc-200 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100">
                <option>UTC</option>
                <option>America/New_York</option>
                <option>Europe/London</option>
                <option>Asia/Tokyo</option>
              </select>
            </div>
          </div>
        </div>

        {/* Email Settings */}
        <div className="rounded-md border border-zinc-200 bg-white px-5 py-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">Email Settings</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-zinc-900">Welcome Emails</p>
                <p className="text-[10px] text-zinc-600">Send to new users</p>
              </div>
              <input type="checkbox" defaultChecked className="rounded" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-zinc-900">Payment Confirmations</p>
                <p className="text-[10px] text-zinc-600">Send after successful payment</p>
              </div>
              <input type="checkbox" defaultChecked className="rounded" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-zinc-900">Weekly Digest</p>
                <p className="text-[10px] text-zinc-600">Platform activity summary</p>
              </div>
              <input type="checkbox" className="rounded" />
            </div>
          </div>
        </div>

        {/* Payment Settings */}
        <div className="rounded-md border border-zinc-200 bg-white px-5 py-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">Payment Settings</h2>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                Default Currency
              </label>
              <select className="w-full rounded-md border border-zinc-200 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100">
                <option>USD - US Dollar</option>
                <option>EUR - Euro</option>
                <option>GBP - British Pound</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-zinc-700">
                Payment Gateway
              </label>
              <select className="w-full rounded-md border border-zinc-200 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100">
                <option>Stripe</option>
                <option>PayPal</option>
              </select>
            </div>
          </div>
        </div>

        {/* Security Settings */}
        <div className="rounded-md border border-zinc-200 bg-white px-5 py-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">Security Settings</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-zinc-900">Two-Factor Authentication</p>
                <p className="text-[10px] text-zinc-600">Require for all admins</p>
              </div>
              <input type="checkbox" defaultChecked className="rounded" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-zinc-900">Session Timeout</p>
                <p className="text-[10px] text-zinc-600">Auto-logout after inactivity</p>
              </div>
              <select className="rounded-md border border-zinc-200 px-2 py-1 text-xs">
                <option>30 minutes</option>
                <option>1 hour</option>
                <option>4 hours</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
        >
          Cancel
        </button>
        <button
          type="button"
          className="rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-600"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
}
