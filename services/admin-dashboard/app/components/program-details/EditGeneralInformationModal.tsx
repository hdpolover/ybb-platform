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
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 px-3 md:px-4">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-md border border-zinc-200 bg-white text-sm text-zinc-700 shadow-lg">
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Edit General Information</h2>
            <p className="text-xs text-zinc-500 md:text-sm">
              Update master data for <span className="font-semibold text-zinc-900">{programName}</span> including
              identity, media assets, contact, and key narratives.
            </p>
          </div>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3 text-xs md:text-sm">
          {/* Identitas Programnya */}
          <section className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <IdentificationIcon className="h-5 w-5 text-blue-500" />
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 md:text-base">Program Identity</h3>
                <p className="text-xs text-zinc-500 md:text-sm">
                  Core identifiers that will be displayed on landing pages and marketing materials.
                </p>
              </div>
            </div>
            <div className="mt-2 grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">Program Category Name</label>
                <input
                  type="text"
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  defaultValue="Youth Leadership & Cultural Immersion"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">Program Type</label>
                <input
                  type="text"
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  defaultValue="Hybrid (Online Preparation + Onsite Program)"
                />
              </div>
            </div>
            <div className="mt-2 grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-zinc-700">Tagline</label>
                <input
                  type="text"
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  defaultValue="Empowering young leaders to collaborate, innovate, and create global impact in Japan."
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-zinc-700">Website URL</label>
                <input
                  type="url"
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-blue-700 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  defaultValue="https://youthbreaktheboundaries.com/japan-youth-summit-2026"
                />
              </div>
            </div>
          </section>

          {/* Asset Medianya */}
          <section className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <PhotoIcon className="h-5 w-5 text-blue-500" />
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 md:text-base">Media Assets</h3>
                <p className="text-xs text-zinc-500 md:text-sm">
                  Upload logo and main banner assets, and configure the main video URL.
                </p>
              </div>
            </div>
            <div className="mt-2 grid gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">Logo Image</label>
                <button
                  type="button"
                  className="flex h-24 w-full items-center justify-center rounded-md border border-dashed border-zinc-300 bg-white text-center text-[11px] text-zinc-500 hover:border-blue-400 hover:bg-blue-50/40"
                  onClick={handleClickLogoUpload}
                >
                  <div className="space-y-1 px-2">
                    <div className="text-xs font-medium text-zinc-700">
                      {logoFileName ? "Logo image selected" : "Drop logo here or click to upload."}
                    </div>
                    {logoFileName ? (
                      <div className="truncate text-[11px] text-zinc-600">{logoFileName}</div>
                    ) : (
                      <div className="text-[11px]">Supported formats: JPG, PNG, GIF. Max size: 2MB</div>
                    )}
                  </div>
                </button>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoFileChange}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">Main Banner Image</label>
                <button
                  type="button"
                  className="flex h-24 w-full items-center justify-center rounded-md border border-dashed border-zinc-300 bg-white text-center text-[11px] text-zinc-500 hover:border-blue-400 hover:bg-blue-50/40"
                  onClick={handleClickBannerUpload}
                >
                  <div className="space-y-1 px-2">
                    <div className="text-xs font-medium text-zinc-700">
                      {bannerFileName ? "Banner image selected" : "Drop banner here or click to upload."}
                    </div>
                    {bannerFileName ? (
                      <div className="truncate text-[11px] text-zinc-600">{bannerFileName}</div>
                    ) : (
                      <div className="text-[11px]">Supported formats: JPG, PNG, GIF. Max size: 2MB</div>
                    )}
                  </div>
                </button>
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleBannerFileChange}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">Main Video URL</label>
                <input
                  type="url"
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-blue-700 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  defaultValue="https://youtu.be/example-jys-2026"
                />
              </div>
            </div>
          </section>

          {/* Deskripsi Programnya */}
          <section className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <GlobeAltIcon className="h-5 w-5 text-blue-500" />
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 md:text-base">Program Description</h3>
                <p className="text-xs text-zinc-500 md:text-sm">High-level description shown on program pages.</p>
              </div>
            </div>
            <div className="mt-2">
              <textarea
                rows={4}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                defaultValue="Japan Youth Summit 2026 is a global youth forum that brings together emerging leaders from diverse backgrounds to discuss pressing global issues, experience Japanese culture, and collaborate on concrete youth-led initiatives."
              />
            </div>
          </section>

          {/* Informasi Kontaknya */}
          <section className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <PhoneIcon className="h-5 w-5 text-blue-500" />
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 md:text-base">Contact Information</h3>
                <p className="text-xs text-zinc-500 md:text-sm">Primary contact for participants and partners.</p>
              </div>
            </div>
            <div className="mt-2 grid gap-3 md:grid-cols-3">
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-zinc-700">Contact</label>
                <input
                  type="text"
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  defaultValue="Youth Break the Boundaries (YBB) Program Team"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">Location</label>
                <input
                  type="text"
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus;border-blue-500 focus:ring-2 focus:ring-blue-100"
                  defaultValue="Tokyo, Japan"
                />
              </div>
              <div className="md:col-span-3 md:max-w-sm">
                <label className="mb-1 block text-xs font-medium text-zinc-700">Email</label>
                <input
                  type="email"
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-blue-700 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  defaultValue="support@youthbreaktheboundaries.com"
                />
              </div>
            </div>
          </section>

          {/* bagian Sosmednya */}
          <section className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <AtSymbolIcon className="h-5 w-5 text-blue-500" />
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 md:text-base">Social Media</h3>
                <p className="text-xs text-zinc-500 md:text-sm">Official program social channels and assets.</p>
              </div>
            </div>
            <div className="mt-2 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">Instagram</label>
                <input
                  type="url"
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-blue-700 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  defaultValue="https://instagram.com/japanyouthsummit"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">TikTok</label>
                <input
                  type="url"
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-blue-700 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  defaultValue="https://tiktok.com/@japanyouthsummit"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">YouTube</label>
                <input
                  type="url"
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-blue-700 shadow-sm outline-none transition placeholder;text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  defaultValue="https://youtube.com/@youthbreaktheboundaries"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">Telegram</label>
                <input
                  type="url"
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-blue-700 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  defaultValue="https://t.me/jys2026_official"
                />
              </div>
              <div className="lg:col-span-2">
                <label className="mb-1 block text-xs font-medium text-zinc-700">Sponsor Canva URL</label>
                <input
                  type="url"
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-blue-700 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  defaultValue="https://www.canva.com/design/jys-2026-sponsorship-kit"
                />
              </div>
            </div>
          </section>

          {/* bagian Informasi Tambahan */}
          <section className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <HeartIcon className="h-5 w-5 text-blue-500" />
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 md:text-base">Additional Information</h3>
                <p className="text-xs text-zinc-500 md;text-sm">Long-form narrative about the program.</p>
              </div>
            </div>
            <div className="mt-2">
              <textarea
                rows={4}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                defaultValue="Japan Youth Summit is part of Youth Break the Boundaries' global flagship programs, designed to create a safe, inclusive, and collaborative space for young leaders who are passionate about SDGs, diplomacy, and cross-cultural understanding."
              />
            </div>
          </section>

          {/* Values utama ( Core Values ) */}
          <section className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <FlagIcon className="h-5 w-5 text-blue-500" />
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 md:text-base">Core Values</h3>
                <p className="text-xs text-zinc-500 md;text-sm">Vision and mission statements for this program.</p>
              </div>
            </div>
            <div className="mt-2 grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">Japan Youth Summit Vision</label>
                <textarea
                  rows={3}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  defaultValue="To become a leading youth platform that empowers young leaders to collaborate and co-create innovative solutions for global challenges through meaningful engagement in Japan."
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">Japan Youth Summit Mission</label>
                <textarea
                  rows={3}
                  className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder;text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  defaultValue={"Facilitate intercultural dialogue and collaboration among youth leaders.\nPromote understanding of Japanese culture, innovation, and diplomacy.\nEncourage youth-led initiatives aligned with the Sustainable Development Goals."}
                />
              </div>
            </div>
          </section>

          {/* bagian Objektif ( Objectives ) */}
          <section className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <PlayCircleIcon className="h-5 w-5 text-blue-500" />
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 md:text-base">Objectives</h3>
                <p className="text-xs text-zinc-500 md:text-sm">
                  The Japan Youth Summit program is held to achieve the following objectives.
                </p>
              </div>
            </div>
            <div className="mt-2">
              <textarea
                rows={4}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder;text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                defaultValue={"• Provide a platform for youth to present and discuss solutions to global challenges.\n• Strengthen leadership, negotiation, and public speaking skills of participants.\n• Build an international network of young leaders and changemakers.\n• Expose participants to Japanese culture, innovation, and best practices."}
              />
            </div>
          </section>

          {/* bagian Benefits */}
          <section className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <GiftTopIcon className="h-5 w-5 text-blue-500" />
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 md:text-base">Benefits</h3>
                <p className="text-xs text-zinc-500 md:text-sm">Delegates benefits and value proposition.</p>
              </div>
            </div>
            <div className="mt-2">
              <textarea
                rows={4}
                className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder;text-zinc-400 focus;border-blue-500 focus:ring-2 focus:ring-blue-100"
                defaultValue={"• International symposium and panel discussion with experts and practitioners.\n• Cultural immersion activities and city tour in Tokyo or surrounding areas.\n• Certificate of participation and potential award recognition.\n• Access to YBB global alumni network and future program opportunities."}
              />
            </div>
          </section>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-4 py-3 text-xs md:text-sm">
          <button
            type="button"
            className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 font-medium text-zinc-700 shadow-sm hover:bg-zinc-100"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-md border border-blue-500 bg-blue-500 px-3 py-1.5 font-semibold text-white shadow-sm hover:bg-blue-600"
            onClick={onClose}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

