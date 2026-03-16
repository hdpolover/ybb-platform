"use client";

import { useState, useRef } from "react";
import {
  IdentificationIcon,
  PhotoIcon,
  GlobeAltIcon,
  PhoneIcon,
  AtSymbolIcon,
  HeartIcon,
  FlagIcon,
  PlayCircleIcon,
  GiftTopIcon,
} from "@heroicons/react/24/solid";

interface EditGeneralInformationModalProps {
  programName: string;
  onClose: () => void;
}

export function EditGeneralInformationModal({
  programName,
  onClose,
}: EditGeneralInformationModalProps) {
  const [logoFileName, setLogoFileName] = useState<string | null>(null);
  const [bannerFileName, setBannerFileName] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);

  const handleClickLogoUpload = () => {
    if (logoInputRef.current) logoInputRef.current.click();
  };

  const handleClickBannerUpload = () => {
    if (bannerInputRef.current) bannerInputRef.current.click();
  };

  const handleLogoFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setLogoFileName(file ? file.name : null);
  };

  const handleBannerFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setBannerFileName(file ? file.name : null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6">
      <div className="flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-zinc-900">Edit General Information</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Update master data for <span className="font-semibold text-zinc-900">{programName}</span> including
              identity, media assets, contact, and key narratives.
            </p>
          </div>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
            onClick={onClose}
          >
            <span className="text-xl leading-none">×</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          {/* Identitas Programnya */}
          <section className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3 border-b border-zinc-200 pb-3">
              <IdentificationIcon className="h-5 w-5 text-blue-500" />
              <div>
                <h3 className="text-base font-bold text-zinc-900">Program Identity</h3>
                <p className="text-xs text-zinc-500">
                  Core identifiers that will be displayed on landing pages and marketing materials.
                </p>
              </div>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-500">Brand Name</label>
                <input
                  type="text"
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  defaultValue="Youth Leadership & Cultural Immersion"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-500">Program Type</label>
                <input
                  type="text"
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  defaultValue="Hybrid (Online Preparation + Onsite Program)"
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-zinc-500">Tagline</label>
                <input
                  type="text"
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  defaultValue="Empowering young leaders to collaborate, innovate, and create global impact in Japan."
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-zinc-500">Website URL</label>
                <input
                  type="url"
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  defaultValue="https://youthbreaktheboundaries.com/japan-youth-summit-2026"
                />
              </div>
            </div>
          </section>

          {/* Asset Medianya */}
          <section className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3 border-b border-zinc-200 pb-3">
              <PhotoIcon className="h-5 w-5 text-blue-500" />
              <div>
                <h3 className="text-base font-bold text-zinc-900">Media Assets</h3>
                <p className="text-xs text-zinc-500">
                  Upload logo and main banner assets, and configure the main video URL.
                </p>
              </div>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-500">Logo Image</label>
                <button
                  type="button"
                  className="flex w-full items-center justify-center rounded-md border border-dashed border-zinc-300 bg-white py-6 text-center shadow-sm transition hover:border-blue-400 hover:bg-blue-50/40"
                  onClick={handleClickLogoUpload}
                >
                  <div className="space-y-1.5 px-4">
                    <div className="text-sm font-semibold text-zinc-700">
                      {logoFileName ? "Logo image selected" : "Click to upload logo"}
                    </div>
                    {logoFileName ? (
                      <div className="truncate text-xs font-medium text-blue-600">{logoFileName}</div>
                    ) : (
                      <div className="text-xs text-zinc-500">JPG, PNG, GIF up to 2MB</div>
                    )}
                  </div>
                </button>
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoFileChange} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-500">Main Banner Image</label>
                <button
                  type="button"
                  className="flex w-full items-center justify-center rounded-md border border-dashed border-zinc-300 bg-white py-6 text-center shadow-sm transition hover:border-blue-400 hover:bg-blue-50/40"
                  onClick={handleClickBannerUpload}
                >
                  <div className="space-y-1.5 px-4">
                    <div className="text-sm font-semibold text-zinc-700">
                      {bannerFileName ? "Banner image selected" : "Click to upload banner"}
                    </div>
                    {bannerFileName ? (
                      <div className="truncate text-xs font-medium text-blue-600">{bannerFileName}</div>
                    ) : (
                      <div className="text-xs text-zinc-500">JPG, PNG, GIF up to 2MB</div>
                    )}
                  </div>
                </button>
                <input ref={bannerInputRef} type="file" accept="image/*" className="hidden" onChange={handleBannerFileChange} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-500">Main Video URL</label>
                <input
                  type="url"
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  defaultValue="https://youtu.be/example-jys-2026"
                />
              </div>
            </div>
          </section>

          {/* Deskripsi Programnya */}
          <section className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3 border-b border-zinc-200 pb-3">
              <GlobeAltIcon className="h-5 w-5 text-blue-500" />
              <div>
                <h3 className="text-base font-bold text-zinc-900">Program Description</h3>
                <p className="text-xs text-zinc-500">High-level description shown on program pages.</p>
              </div>
            </div>
            <div>
              <textarea
                rows={4}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm leading-relaxed text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                defaultValue="Japan Youth Summit 2026 is a global youth forum that brings together emerging leaders from diverse backgrounds to discuss pressing global issues, experience Japanese culture, and collaborate on concrete youth-led initiatives."
              />
            </div>
          </section>

          {/* Informasi Kontaknya */}
          <section className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3 border-b border-zinc-200 pb-3">
              <PhoneIcon className="h-5 w-5 text-blue-500" />
              <div>
                <h3 className="text-base font-bold text-zinc-900">Contact Information</h3>
                <p className="text-xs text-zinc-500">Primary contact for participants and partners.</p>
              </div>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-zinc-500">Contact Team</label>
                <input
                  type="text"
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  defaultValue="Youth Break the Boundaries (YBB) Program Team"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-500">Location</label>
                <input
                  type="text"
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  defaultValue="Tokyo, Japan"
                />
              </div>
              <div className="md:col-span-3 lg:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-zinc-500">Email</label>
                <input
                  type="email"
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  defaultValue="support@youthbreaktheboundaries.com"
                />
              </div>
            </div>
          </section>

          {/* Bagian Sosmednya */}
          <section className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3 border-b border-zinc-200 pb-3">
              <AtSymbolIcon className="h-5 w-5 text-blue-500" />
              <div>
                <h3 className="text-base font-bold text-zinc-900">Social Media</h3>
                <p className="text-xs text-zinc-500">Official program social channels and assets.</p>
              </div>
            </div>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-500">Instagram URL</label>
                <input
                  type="url"
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  defaultValue="https://instagram.com/japanyouthsummit"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-500">TikTok URL</label>
                <input
                  type="url"
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  defaultValue="https://tiktok.com/@japanyouthsummit"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-500">YouTube URL</label>
                <input
                  type="url"
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  defaultValue="https://youtube.com/@youthbreaktheboundaries"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-500">Telegram URL</label>
                <input
                  type="url"
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  defaultValue="https://t.me/jys2026_official"
                />
              </div>
              <div className="lg:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-zinc-500">Sponsor Canva URL</label>
                <input
                  type="url"
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  defaultValue="https://www.canva.com/design/jys-2026-sponsorship-kit"
                />
              </div>
            </div>
          </section>

          {/* Bagian Informasi Tambahan */}
          <section className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3 border-b border-zinc-200 pb-3">
              <HeartIcon className="h-5 w-5 text-blue-500" />
              <div>
                <h3 className="text-base font-bold text-zinc-900">Additional Information</h3>
                <p className="text-xs text-zinc-500">Long-form narrative about the program.</p>
              </div>
            </div>
            <div>
              <textarea
                rows={4}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm leading-relaxed text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                defaultValue="Japan Youth Summit is part of Youth Break the Boundaries' global flagship programs, designed to create a safe, inclusive, and collaborative space for young leaders who are passionate about SDGs, diplomacy, and cross-cultural understanding."
              />
            </div>
          </section>

          {/* Core Values */}
          <section className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3 border-b border-zinc-200 pb-3">
              <FlagIcon className="h-5 w-5 text-blue-500" />
              <div>
                <h3 className="text-base font-bold text-zinc-900">Core Values</h3>
                <p className="text-xs text-zinc-500">Vision and mission statements for this program.</p>
              </div>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-500">Program Vision</label>
                <textarea
                  rows={4}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm leading-relaxed text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  defaultValue="To become a leading youth platform that empowers young leaders to collaborate and co-create innovative solutions for global challenges through meaningful engagement in Japan."
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-500">Program Mission</label>
                <textarea
                  rows={4}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm leading-relaxed text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  defaultValue={"Facilitate intercultural dialogue and collaboration among youth leaders.\nPromote understanding of Japanese culture, innovation, and diplomacy.\nEncourage youth-led initiatives aligned with the Sustainable Development Goals."}
                />
              </div>
            </div>
          </section>

          {/* Objektif ( Objectives ) */}
          <section className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3 border-b border-zinc-200 pb-3">
              <PlayCircleIcon className="h-5 w-5 text-blue-500" />
              <div>
                <h3 className="text-base font-bold text-zinc-900">Objectives</h3>
                <p className="text-xs text-zinc-500">
                  The program is held to achieve the following objectives.
                </p>
              </div>
            </div>
            <div>
              <textarea
                rows={4}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm leading-relaxed text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                defaultValue={"• Provide a platform for youth to present and discuss solutions to global challenges.\n• Strengthen leadership, negotiation, and public speaking skills of participants.\n• Build an international network of young leaders and changemakers.\n• Expose participants to Japanese culture, innovation, and best practices."}
              />
            </div>
          </section>

          {/* Benefits */}
          <section className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3 border-b border-zinc-200 pb-3">
              <GiftTopIcon className="h-5 w-5 text-blue-500" />
              <div>
                <h3 className="text-base font-bold text-zinc-900">Benefits</h3>
                <p className="text-xs text-zinc-500">Delegates benefits and value proposition.</p>
              </div>
            </div>
            <div>
              <textarea
                rows={4}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm leading-relaxed text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                defaultValue={"• International symposium and panel discussion with experts and practitioners.\n• Cultural immersion activities and city tour in Tokyo or surrounding areas.\n• Certificate of participation and potential award recognition.\n• Access to YBB global alumni network and future program opportunities."}
              />
            </div>
          </section>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-zinc-200 bg-zinc-50 px-6 py-4">
          <button
            type="button"
            className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-200"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
            onClick={onClose}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}