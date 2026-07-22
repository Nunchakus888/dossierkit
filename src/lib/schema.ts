import { z } from "zod";

export const localeSchema = z.enum(["zh", "en"]);

export const localizedStringSchema = z.object({
  zh: z.string().min(1),
  en: z.string().min(1)
});

const optionalUrlSchema = z
  .string()
  .trim()
  .refine((value) => value === "" || /^https?:\/\//.test(value), {
    message: "Must be empty or an absolute http(s) URL"
  });

export const profileSchema = z
  .object({
    id: z.string().min(1),
    name: localizedStringSchema,
    headline: localizedStringSchema,
    summary: localizedStringSchema,
    yearsOfExperience: z.number().int().nonnegative(),
    location: localizedStringSchema,
    avatar: z.string().min(1).default("avatar.png"),
    companies: z
      .array(
        z.object({
          name: z.string().min(1),
          type: z.string().min(1)
        })
      )
      .default([]),
    targetRoles: z
      .array(
        z.object({
          id: z.string().min(1),
          priority: z.number().int().positive()
        })
      )
      .default([]),
    links: z
      .object({
        email: z.string().email(),
        github: optionalUrlSchema.default(""),
        linkedin: optionalUrlSchema.default(""),
        maimai: optionalUrlSchema.default(""),
        huggingface: optionalUrlSchema.default(""),
        website: optionalUrlSchema.default("")
      })
      .passthrough(),
    availability: z
      .object({
        status: localizedStringSchema,
        preferredLocations: z.array(z.string()).default([]),
        expectedPackage: localizedStringSchema.optional()
      })
      .passthrough()
  })
  .passthrough();

export const experienceSchema = z.object({
  experiences: z.array(
    z
      .object({
        company: localizedStringSchema,
        role: localizedStringSchema,
        period: localizedStringSchema.or(z.string().min(1)),
        location: localizedStringSchema.optional(),
        summary: localizedStringSchema,
        featuredProjects: z
          .array(
            z.object({
              title: localizedStringSchema,
              summary: localizedStringSchema,
              link: z.string().url().optional(),
              linkText: localizedStringSchema.optional(),
              details: z
                .array(
                  z.object({
                    title: localizedStringSchema,
                    summary: localizedStringSchema
                  })
                )
                .default([])
            })
          )
          .default([]),
        highlights: z.array(localizedStringSchema).default([]),
        tags: z.array(z.string()).default([])
      })
      .passthrough()
  )
});

export const educationSchema = z.object({
  education: z
    .array(
      z
        .object({
          school: localizedStringSchema,
          degree: localizedStringSchema,
          period: z.string().min(1),
          summary: localizedStringSchema.optional()
        })
        .passthrough()
    )
    .default([])
});

export const skillsSchema = z.object({
  skillGroups: z.array(
    z
      .object({
        id: z.string().min(1),
        title: localizedStringSchema,
        description: localizedStringSchema.optional(),
        skills: z.array(z.string()).default([])
      })
      .passthrough()
  )
});

const rolePlatformDimensionSchema = z
  .object({
    title: localizedStringSchema,
    summary: localizedStringSchema
  })
  .passthrough();

export const rolesSchema = z.object({
  roles: z.array(
    z
      .object({
        id: z.string().min(1),
        path: z.string().min(1),
        title: localizedStringSchema,
        headline: localizedStringSchema,
        summary: localizedStringSchema.optional(),
        focusAreas: z.array(z.string()).default([]),
        relatedCases: z.array(z.string()).default([]),
        relatedLabs: z.array(z.string()).default([]),
        relatedWriting: z.array(z.string()).default([]),
        platformProfile: z
          .object({
            badge: z.string().min(1),
            title: localizedStringSchema,
            summary: localizedStringSchema,
            sourceWriting: z.string().min(1).optional(),
            capabilities: z.array(localizedStringSchema).default([]),
            dimensions: z.array(rolePlatformDimensionSchema).default([])
          })
          .passthrough()
          .optional()
      })
      .passthrough()
  )
});

export const metricsSchema = z.object({
  metrics: z
    .array(
      z
        .object({
          label: localizedStringSchema,
          value: localizedStringSchema.or(z.string()),
          description: localizedStringSchema
        })
        .passthrough()
    )
    .default([])
});

export const themeSchema = z
  .object({
    preset: z.string().min(1),
    colors: z
      .object({
        background: z.string().min(1),
        surface: z.string().min(1).default("#ffffff"),
        foreground: z.string().min(1),
        muted: z.string().min(1),
        border: z.string().min(1),
        accent: z.string().min(1),
        accentSoft: z.string().min(1),
        warm: z.string().min(1).default("#9A4D2F")
      })
      .passthrough(),
    typography: z
      .object({
        sans: z.string().min(1),
        mono: z.string().min(1),
        headingWeight: z.number().default(650),
        bodyWeight: z.number().default(400)
      })
      .passthrough(),
    layout: z
      .object({
        maxWidth: z.string().min(1),
        cardRadius: z.string().min(1),
        density: z.string().min(1),
        heroStyle: z.string().min(1),
        dashboardStyle: z.string().min(1)
      })
      .passthrough(),
    motion: z
      .object({
        enabled: z.boolean(),
        level: z.string().min(1)
      })
      .passthrough()
  })
  .passthrough();

export const resumeSchema = z
  .object({
    filename: z.string().min(1),
    sections: z.array(z.string()).default([]),
    highlights: z.array(localizedStringSchema).default([])
  })
  .passthrough();

export const homeSchema = z
  .object({
    sections: z.array(
      z
        .object({
          type: z.string().min(1),
          variant: z.string().optional(),
          limit: z.number().int().positive().optional()
        })
        .passthrough()
    )
  })
  .passthrough();

export const navigationSchema = z
  .object({
    brand: z
      .object({
        mark: z.string().min(1).default("DK"),
        labelMode: z.enum(["name", "headline", "none"]).default("name")
      })
      .default({ mark: "DK", labelMode: "name" }),
    footer: z
      .object({
        tagline: localizedStringSchema
      })
      .optional(),
    items: z.array(
      z
        .object({
          id: z.string().min(1),
          label: localizedStringSchema,
          path: z.string().min(1),
          icon: z.string().optional(),
          placement: z.enum(["primary", "secondary", "action"]).default("primary"),
          external: z.boolean().default(false)
        })
        .passthrough()
    )
  })
  .passthrough();

const titleSegmentSchema = z.object({
  text: z.string(),
  tone: z.enum(["mint", "blue", "cyan", "ink", "muted"]).default("ink")
});

const titleLineSchema = z.object({
  segments: z.array(titleSegmentSchema)
});

export const designSchema = z
  .object({
    style: z.enum(["minimal-tech", "playful-tech"]).default("playful-tech"),
    brand: z
      .object({
        icon: z.enum(["folder-face", "monogram"]).default("folder-face")
      })
      .default({ icon: "folder-face" }),
    hero: z
      .object({
        eyebrow: localizedStringSchema,
        title: z.object({
          zh: z.array(titleLineSchema),
          en: z.array(titleLineSchema)
        }),
        subtitle: localizedStringSchema,
        primaryAction: z.object({
          label: localizedStringSchema,
          path: z.string().min(1),
          icon: z.string().optional()
        }),
        secondaryAction: z.object({
          label: localizedStringSchema,
          path: z.string().min(1),
          icon: z.string().optional()
        })
      })
      .passthrough(),
    quickLinks: z.array(
      z
        .object({
          id: z.string().min(1),
          label: localizedStringSchema,
          description: localizedStringSchema,
          path: z.string().min(1),
          icon: z.string().min(1),
          tone: z.enum(["mint", "blue", "cyan"]).default("mint")
        })
        .passthrough()
    ),
    contactStrip: z
      .object({
        label: localizedStringSchema,
        actionLabel: localizedStringSchema,
        icon: z.string().min(1).default("mail")
      })
      .passthrough()
  })
  .passthrough();

export const contentMetricSchema = z
  .object({
    label: z.string().min(1),
    value: z.string().min(1),
    description: z.string().optional()
  })
  .passthrough();

export const contentFrontmatterSchema = z
  .object({
    slug: z
      .string()
      .max(72)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Must be a lowercase, hyphenated URL slug")
      .optional(),
    locale: localeSchema,
    translationKey: z.string().min(1).optional(),
    translationStatus: z
      .enum(["draft", "machine-translated", "reviewed", "complete"])
      .default("reviewed"),
    lastReviewedAt: z.string().optional(),
    title: z.string().min(1),
    summary: z.string().min(1),
    featured: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
    targetRoles: z.array(z.string()).default([]),
    relatedRoles: z.array(z.string()).default([]),
    metrics: z.array(contentMetricSchema).default([]),
    period: z.string().optional(),
    date: z.string().optional(),
    updatedAt: z.string().optional(),
    kind: z.enum(["research", "learning", "engineering"]).optional(),
    topics: z.array(z.string()).default([]),
    sourceUrl: z.string().url().optional(),
    contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/).optional()
  })
  .passthrough();

export type LocalizedString = z.infer<typeof localizedStringSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type Experience = z.infer<typeof experienceSchema>;
export type Education = z.infer<typeof educationSchema>;
export type Skills = z.infer<typeof skillsSchema>;
export type Roles = z.infer<typeof rolesSchema>;
export type Metrics = z.infer<typeof metricsSchema>;
export type Theme = z.infer<typeof themeSchema>;
export type Resume = z.infer<typeof resumeSchema>;
export type Home = z.infer<typeof homeSchema>;
export type Navigation = z.infer<typeof navigationSchema>;
export type Design = z.infer<typeof designSchema>;
export type ContentFrontmatter = z.infer<typeof contentFrontmatterSchema>;
