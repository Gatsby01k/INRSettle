import { OrganizationStatus, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for the bootstrap seed.`);
  return value;
}

async function main() {
  const email = required("BOOTSTRAP_ADMIN_EMAIL").toLowerCase();
  const name = required("BOOTSTRAP_ADMIN_NAME");
  const password = required("BOOTSTRAP_ADMIN_PASSWORD");
  const organizationId = required("BOOTSTRAP_ORGANIZATION_ID");
  const legalName = required("BOOTSTRAP_ORGANIZATION_LEGAL_NAME");
  const displayName = required("BOOTSTRAP_ORGANIZATION_DISPLAY_NAME");
  const country = process.env.BOOTSTRAP_ORGANIZATION_COUNTRY?.trim().toUpperCase() || "IN";

  if (password.length < 14) {
    throw new Error("BOOTSTRAP_ADMIN_PASSWORD must contain at least 14 characters.");
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error("BOOTSTRAP_ADMIN_EMAIL must be a valid email address.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: { name },
    create: {
      email,
      name,
      passwordHash,
      mfaEnabled: false,
    },
  });

  const organization = await prisma.organization.upsert({
    where: { id: organizationId },
    update: { legalName, displayName, country },
    create: {
      id: organizationId,
      legalName,
      displayName,
      country,
      status: OrganizationStatus.ACTIVE,
    },
  });

  await prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId: organization.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      organizationId: organization.id,
      role: Role.OWNER,
    },
  });

  await prisma.organizationSettings.upsert({
    where: { organizationId: organization.id },
    update: {},
    create: {
      organizationId: organization.id,
      approvalThreshold: "2500000",
      quoteTtlSeconds: 900,
      reconciliationEmail: process.env.BOOTSTRAP_RECONCILIATION_EMAIL?.trim() || email,
    },
  });

  console.log(`Bootstrap complete for ${displayName}. Enroll MFA before granting operational access.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
