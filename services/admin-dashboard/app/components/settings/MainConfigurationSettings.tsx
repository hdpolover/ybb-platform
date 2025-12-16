"use client";

import { useState } from "react";
import { MainConfigurationHeader } from "./mainConfiguration/MainConfigurationHeader";
import { MainConfigurationContent } from "./mainConfiguration/MainConfigurationContent";

export type MainConfigurationSettingsProps = {
  programName: string;
};

export function MainConfigurationSettings({
  programName,
}: MainConfigurationSettingsProps) {
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [emailVerification, setEmailVerification] = useState<"Optional" | "Required">(
    "Required",
  );
  const [programActive, setProgramActive] = useState(true);
  const [usdToIdrRate, setUsdToIdrRate] = useState(16900);

  const programStatusLabel = programActive ? "Active" : "Inactive";
  const registrationStatusLabel = registrationOpen ? "Open" : "Closed";

  return (
    <main className="space-y-4 text-sm md:text-base">
      <MainConfigurationHeader
        programName={programName}
        programStatusLabel={programStatusLabel}
        registrationStatusLabel={registrationStatusLabel}
      />

      <MainConfigurationContent
        maintenanceEnabled={maintenanceEnabled}
        onToggleMaintenance={() => setMaintenanceEnabled((previous) => !previous)}
        registrationOpen={registrationOpen}
        onToggleRegistration={() => setRegistrationOpen((previous) => !previous)}
        emailVerification={emailVerification}
        onToggleEmailVerification={() =>
          setEmailVerification((previous) =>
            previous === "Required" ? "Optional" : "Required",
          )
        }
        programActive={programActive}
        onToggleProgramActive={() => setProgramActive((previous) => !previous)}
        usdToIdrRate={usdToIdrRate}
        onChangeUsdToIdrRate={(value) => setUsdToIdrRate(value)}
      />
    </main>
  );
}
