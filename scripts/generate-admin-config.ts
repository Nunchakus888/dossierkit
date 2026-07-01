import fs from "node:fs";
import path from "node:path";
import { stringify } from "yaml";
import { activeProfile, repository, siteUrl } from "../src/lib/config";

export async function main(args = process.argv.slice(2)) {
  const profileId = valueAfter(args, "--profile") || activeProfile;
  const repo = valueAfter(args, "--repo") || repository || detectGitHubRepository() || "owner/dossierkit";
  const branch = valueAfter(args, "--branch") || "main";
  const publicSiteUrl = normalizeSiteUrl(valueAfter(args, "--site-url") || siteUrl);
  const out = path.join(process.cwd(), "public", "admin", "config.yml");

  const config = {
    backend: {
      name: "github",
      repo,
      branch,
      base_url: publicSiteUrl,
      auth_endpoint: "api/auth"
    },
    local_backend: true,
    media_folder: `profiles/${profileId}/assets`,
    public_folder: `/profile-assets/${profileId}`,
    publish_mode: "editorial_workflow",
    collections: [
      profileFiles(profileId),
      contentFolder(profileId, "cases_zh", "Cases ZH", "zh", "cases"),
      contentFolder(profileId, "cases_en", "Cases EN", "en", "cases"),
      contentFolder(profileId, "lab_zh", "Lab ZH", "zh", "lab"),
      contentFolder(profileId, "lab_en", "Lab EN", "en", "lab"),
      contentFolder(profileId, "writing_zh", "Writing ZH", "zh", "writing"),
      contentFolder(profileId, "writing_en", "Writing EN", "en", "writing")
    ]
  };

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, stringify(config), "utf8");
  console.log(`Generated ${out}`);
  console.log(`Profile: ${profileId}`);
  console.log(`Repository: ${repo}`);
}

function valueAfter(args: string[], flag: string) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function normalizeSiteUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function detectGitHubRepository() {
  try {
    const gitConfig = fs.readFileSync(path.join(process.cwd(), ".git", "config"), "utf8");
    const match = gitConfig.match(/github\.com[:/](.+?\/.+?)(?:\.git)?\s*$/m);
    return match?.[1];
  } catch {
    return undefined;
  }
}

function profileFiles(profileId: string) {
  return {
    name: "profile",
    label: "Profile Config",
    files: [
      {
        label: "Profile",
        name: "profile",
        file: `profiles/${profileId}/profile.yaml`,
        fields: [
          { label: "ID", name: "id", widget: "string" },
          localizedField("Name", "name"),
          localizedField("Headline", "headline"),
          localizedField("Summary", "summary", "text"),
          { label: "Years of Experience", name: "yearsOfExperience", widget: "number" },
          localizedField("Location", "location"),
          { label: "Avatar", name: "avatar", widget: "image", required: false },
          {
            label: "Companies",
            name: "companies",
            widget: "list",
            required: false,
            fields: [
              { label: "Name", name: "name", widget: "string" },
              { label: "Type", name: "type", widget: "string" }
            ]
          },
          {
            label: "Focus",
            name: "targetRoles",
            widget: "list",
            required: false,
            fields: [
              { label: "ID", name: "id", widget: "string" },
              { label: "Priority", name: "priority", widget: "number" }
            ]
          },
          {
            label: "Links",
            name: "links",
            widget: "object",
            fields: [
              { label: "Email", name: "email", widget: "string" },
              { label: "GitHub", name: "github", widget: "string", required: false },
              { label: "LinkedIn", name: "linkedin", widget: "string", required: false },
              { label: "Website", name: "website", widget: "string", required: false }
            ]
          },
          {
            label: "Availability",
            name: "availability",
            widget: "object",
            fields: [
              localizedField("Status", "status"),
              { label: "Preferred Locations", name: "preferredLocations", widget: "list", required: false },
              localizedField("Expected Package", "expectedPackage", "string", false)
            ]
          }
        ]
      },
      experienceFile(profileId),
      educationFile(profileId),
      skillsFile(profileId),
      rolesFile(profileId),
      metricsFile(profileId),
      themeFile(profileId),
      resumeFile(profileId),
      homeFile(profileId),
      navigationFile(profileId),
      designFile(profileId)
    ]
  };
}

function localizedField(label: string, name: string, widget = "string", required = true) {
  return {
    label,
    name,
    widget: "object",
    required,
    fields: [
      { label: "ZH", name: "zh", widget },
      { label: "EN", name: "en", widget }
    ]
  };
}

function localizedValueFields(widget = "string") {
  return [
    { label: "ZH", name: "zh", widget },
    { label: "EN", name: "en", widget }
  ];
}

function localizedListField(label: string, name: string, widget = "text", required = false) {
  return {
    label,
    name,
    widget: "list",
    required,
    fields: localizedValueFields(widget)
  };
}

function assessmentSectionField(label: string, name: string) {
  return {
    label,
    name,
    widget: "list",
    required: false,
    fields: [
      localizedField("Title", "title"),
      localizedField("Summary", "summary", "text", false),
      localizedListField("Items", "items", "text")
    ]
  };
}

function experienceFile(profileId: string) {
  return {
    label: "Experience",
    name: "experience",
    file: `profiles/${profileId}/experience.yaml`,
    fields: [
      {
        label: "Experiences",
        name: "experiences",
        widget: "list",
        fields: [
          { label: "Company", name: "company", widget: "string" },
          localizedField("Role", "role"),
          localizedField("Period", "period"),
          localizedField("Location", "location", "string", false),
          localizedField("Summary", "summary", "text"),
          { label: "Highlights", name: "highlights", widget: "list", fields: localizedValueFields("text") },
          { label: "Tags", name: "tags", widget: "list", required: false }
        ]
      }
    ]
  };
}

function educationFile(profileId: string) {
  return {
    label: "Education",
    name: "education",
    file: `profiles/${profileId}/education.yaml`,
    fields: [
      {
        label: "Education",
        name: "education",
        widget: "list",
        fields: [
          localizedField("School", "school"),
          localizedField("Degree", "degree"),
          { label: "Period", name: "period", widget: "string" },
          localizedField("Summary", "summary", "text", false)
        ]
      }
    ]
  };
}

function skillsFile(profileId: string) {
  return {
    label: "Skills",
    name: "skills",
    file: `profiles/${profileId}/skills.yaml`,
    fields: [
      {
        label: "Skill Groups",
        name: "skillGroups",
        widget: "list",
        fields: [
          { label: "ID", name: "id", widget: "string" },
          localizedField("Title", "title"),
          localizedField("Description", "description", "text", false),
          { label: "Skills", name: "skills", widget: "list" }
        ]
      }
    ]
  };
}

function rolesFile(profileId: string) {
  return {
    label: "Roles",
    name: "roles",
    file: `profiles/${profileId}/roles.yaml`,
    fields: [
      {
        label: "Roles",
        name: "roles",
        widget: "list",
        fields: [
          { label: "ID", name: "id", widget: "string" },
          { label: "Path", name: "path", widget: "string" },
          localizedField("Title", "title"),
          localizedField("Headline", "headline"),
          localizedField("Summary", "summary", "text", false),
          { label: "Focus Areas", name: "focusAreas", widget: "list", required: false },
          { label: "Related Cases", name: "relatedCases", widget: "list", required: false },
          { label: "Related Labs", name: "relatedLabs", widget: "list", required: false },
          { label: "Related Writing", name: "relatedWriting", widget: "list", required: false },
          {
            label: "Positioning Assessment",
            name: "positioningAssessment",
            widget: "object",
            required: false,
            fields: [
              { label: "Source Writing Slug", name: "sourceWriting", widget: "string" },
              { label: "Fit Score", name: "fitScore", widget: "string" },
              localizedField("Conclusion", "conclusion", "text"),
              localizedListField("Target Positioning", "targetPositioning", "text"),
              localizedListField("Evidence", "evidence", "text"),
              assessmentSectionField("Gaps", "gaps"),
              assessmentSectionField("Pending Evidence", "pendingEvidence"),
              localizedListField("Resume Bullets", "resumeBullets", "text"),
              localizedField("Interview Narrative", "interviewNarrative", "text", false),
              localizedListField("Update Rules", "updateRules", "text"),
              localizedListField("Version Log", "versionLog", "text")
            ]
          }
        ]
      }
    ]
  };
}

function metricsFile(profileId: string) {
  return {
    label: "Metrics",
    name: "metrics",
    file: `profiles/${profileId}/metrics.yaml`,
    fields: [
      {
        label: "Metrics",
        name: "metrics",
        widget: "list",
        fields: [
          localizedField("Label", "label"),
          localizedField("Value", "value"),
          localizedField("Description", "description", "text")
        ]
      }
    ]
  };
}

function themeFile(profileId: string) {
  return {
    label: "Theme",
    name: "theme",
    file: `profiles/${profileId}/theme.yaml`,
    fields: [
      { label: "Preset", name: "preset", widget: "string" },
      {
        label: "Colors",
        name: "colors",
        widget: "object",
        fields: ["background", "surface", "foreground", "muted", "border", "accent", "accentSoft", "warm", "mint", "blue", "cyan"].map((name) => ({
          label: name,
          name,
          widget: "string"
        }))
      },
      {
        label: "Typography",
        name: "typography",
        widget: "object",
        fields: [
          { label: "Sans", name: "sans", widget: "string" },
          { label: "Mono", name: "mono", widget: "string" },
          { label: "Heading Weight", name: "headingWeight", widget: "number" },
          { label: "Body Weight", name: "bodyWeight", widget: "number" }
        ]
      },
      {
        label: "Layout",
        name: "layout",
        widget: "object",
        fields: [
          { label: "Max Width", name: "maxWidth", widget: "string" },
          { label: "Card Radius", name: "cardRadius", widget: "string" },
          { label: "Density", name: "density", widget: "string" },
          { label: "Hero Style", name: "heroStyle", widget: "string" },
          { label: "Dashboard Style", name: "dashboardStyle", widget: "string" }
        ]
      },
      {
        label: "Motion",
        name: "motion",
        widget: "object",
        fields: [
          { label: "Enabled", name: "enabled", widget: "boolean" },
          { label: "Level", name: "level", widget: "string" }
        ]
      }
    ]
  };
}

function resumeFile(profileId: string) {
  return {
    label: "Resume",
    name: "resume",
    file: `profiles/${profileId}/resume.yaml`,
    fields: [
      { label: "Filename", name: "filename", widget: "string" },
      { label: "Sections", name: "sections", widget: "list" },
      { label: "Highlights", name: "highlights", widget: "list", fields: localizedValueFields("text") }
    ]
  };
}

function homeFile(profileId: string) {
  return {
    label: "Home",
    name: "home",
    file: `profiles/${profileId}/home.yaml`,
    fields: [
      {
        label: "Sections",
        name: "sections",
        widget: "list",
        fields: [
          { label: "Type", name: "type", widget: "string" },
          { label: "Variant", name: "variant", widget: "string", required: false },
          { label: "Limit", name: "limit", widget: "number", required: false }
        ]
      }
    ]
  };
}

function navigationFile(profileId: string) {
  return {
    label: "Navigation",
    name: "navigation",
    file: `profiles/${profileId}/navigation.yaml`,
    fields: [
      {
        label: "Brand",
        name: "brand",
        widget: "object",
        fields: [
          { label: "Mark", name: "mark", widget: "string" },
          { label: "Label Mode", name: "labelMode", widget: "select", options: ["name", "headline", "none"] }
        ]
      },
      {
        label: "Items",
        name: "items",
        widget: "list",
        fields: [
          { label: "ID", name: "id", widget: "string" },
          localizedField("Label", "label"),
          { label: "Path", name: "path", widget: "string" },
          { label: "Icon", name: "icon", widget: "string", required: false },
          { label: "Placement", name: "placement", widget: "select", options: ["primary", "secondary", "action"] },
          { label: "External", name: "external", widget: "boolean", default: false }
        ]
      }
    ]
  };
}

function designFile(profileId: string) {
  return {
    label: "Design",
    name: "design",
    file: `profiles/${profileId}/design.yaml`,
    fields: [
      { label: "Style", name: "style", widget: "select", options: ["minimal-tech", "playful-tech"] },
      {
        label: "Brand",
        name: "brand",
        widget: "object",
        fields: [{ label: "Icon", name: "icon", widget: "select", options: ["folder-face", "monogram"] }]
      },
      {
        label: "Hero",
        name: "hero",
        widget: "object",
        fields: [
          localizedField("Eyebrow", "eyebrow"),
          {
            label: "Title",
            name: "title",
            widget: "object",
            fields: [
              titleLinesField("ZH", "zh"),
              titleLinesField("EN", "en")
            ]
          },
          localizedField("Subtitle", "subtitle", "text"),
          actionField("Primary Action", "primaryAction"),
          actionField("Secondary Action", "secondaryAction")
        ]
      },
      {
        label: "Quick Links",
        name: "quickLinks",
        widget: "list",
        fields: [
          { label: "ID", name: "id", widget: "string" },
          localizedField("Label", "label"),
          localizedField("Description", "description", "text"),
          { label: "Path", name: "path", widget: "string" },
          { label: "Icon", name: "icon", widget: "string" },
          { label: "Tone", name: "tone", widget: "select", options: ["mint", "blue", "cyan"] }
        ]
      },
      {
        label: "Contact Strip",
        name: "contactStrip",
        widget: "object",
        fields: [
          localizedField("Label", "label"),
          localizedField("Action Label", "actionLabel"),
          { label: "Icon", name: "icon", widget: "string" }
        ]
      }
    ]
  };
}

function titleLinesField(label: string, name: string) {
  return {
    label,
    name,
    widget: "list",
    fields: [
      {
        label: "Segments",
        name: "segments",
        widget: "list",
        fields: [
          { label: "Text", name: "text", widget: "string" },
          { label: "Tone", name: "tone", widget: "select", options: ["mint", "blue", "cyan", "ink", "muted"] }
        ]
      }
    ]
  };
}

function actionField(label: string, name: string) {
  return {
    label,
    name,
    widget: "object",
    fields: [
      localizedField("Label", "label"),
      { label: "Path", name: "path", widget: "string" },
      { label: "Icon", name: "icon", widget: "string", required: false }
    ]
  };
}

function contentFolder(profileId: string, name: string, label: string, locale: string, folder: string) {
  return {
    name,
    label,
    folder: `profiles/${profileId}/content/${locale}/${folder}`,
    create: true,
    extension: "mdx",
    format: "frontmatter",
    slug: "{{slug}}",
    fields: [
      { label: "Slug", name: "slug", widget: "string" },
      { label: "Locale", name: "locale", widget: "hidden", default: locale },
      { label: "Translation Key", name: "translationKey", widget: "string", required: false },
      {
        label: "Translation Status",
        name: "translationStatus",
        widget: "select",
        options: ["draft", "machine-translated", "reviewed", "complete"],
        default: "reviewed"
      },
      { label: "Title", name: "title", widget: "string" },
      { label: "Summary", name: "summary", widget: "text" },
      { label: "Featured", name: "featured", widget: "boolean", default: false },
      { label: "Tags", name: "tags", widget: "list", required: false },
      { label: "Focus", name: "targetRoles", widget: "list", required: false },
      { label: "Body", name: "body", widget: "markdown" }
    ]
  };
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
