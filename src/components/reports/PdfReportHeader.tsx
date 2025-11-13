"use client";

import Image from "next/image";

type PdfReportHeaderProps = {
  title: string;
  reportingPeriod: string;
};

const CONTACT_INFO = {
  name: "Richard Ellis",
  title: "Vice Chairman",
  email: "richardellis1997@gmail.com",
};

export function PdfReportHeader({ title, reportingPeriod }: PdfReportHeaderProps) {
  return (
    <div className="flex flex-col gap-6 text-[#1a1a1a]">
      <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-5">
          <Image
            src="/Hyena%20rondel%20white%20outline.png"
            alt="Round Table Lilongwe 32 Hyena rondel"
            width={120}
            height={120}
            priority
            unoptimized
            className="size-28 max-w-full object-contain"
          />
          <div className="flex flex-col">
            <span className="text-[30px] font-bold uppercase tracking-[0.18em] text-[#1a1a1a]">
              Round Table
            </span>
            <span className="text-sm uppercase tracking-[0.65em] text-[#555555]">
              Lilongwe 32
            </span>
          </div>
        </div>
        <div className="text-right text-[13px] leading-5 text-[#1a1a1a]">
          <p className="text-[15px] font-semibold">{CONTACT_INFO.name}</p>
          <p>{CONTACT_INFO.title}</p>
          <p>
            E-mail: <span className="text-[#1d4ed8]">{CONTACT_INFO.email}</span>
          </p>
        </div>
      </div>

      <div className="text-center text-[12px] uppercase tracking-[0.6em] text-[#666666]">
        Adopt | Adapt | Improve
      </div>

      <div className="h-[1px] w-full bg-[#f97316]" />

      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#f97316]">
          Round Table Lilongwe 32
        </p>
        <h1 className="text-3xl font-bold uppercase tracking-[0.08em] text-[#f97316]">{title}</h1>
        <p className="text-[13px] font-semibold text-[#1a1a1a]">{reportingPeriod}</p>
      </div>
    </div>
  );
}

