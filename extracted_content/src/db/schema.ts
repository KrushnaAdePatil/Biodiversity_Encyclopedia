import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/** Top level groups of life: Plants, Flowers, Insects, Mammals ... */
export const categories = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    nameMr: text("name_mr").notNull().default(""),
    nameHi: text("name_hi").notNull().default(""),
    emoji: text("emoji").notNull().default("🌍"),
    tagline: text("tagline").notNull().default(""),
    description: text("description").notNull().default(""),
    accentFrom: text("accent_from").notNull().default("#16a34a"),
    accentTo: text("accent_to").notNull().default("#0ea5e9"),
    knownSpecies: text("known_species").notNull().default(""),
    wikiTitle: text("wiki_title").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [uniqueIndex("categories_slug_idx").on(t.slug)],
);

/** Sub groups inside a category (Trees, Big Cats, Sharks ...) */
export const subcategories = pgTable(
  "subcategories",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    categorySlug: text("category_slug").notNull(),
    name: text("name").notNull(),
    nameMr: text("name_mr").notNull().default(""),
    emoji: text("emoji").notNull().default("•"),
    blurb: text("blurb").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    uniqueIndex("subcategories_slug_idx").on(t.slug),
    index("subcategories_category_idx").on(t.categorySlug),
  ],
);

export type TaxonomyRank = {
  kingdom: string;
  phylum: string;
  class: string;
  order: string;
  family: string;
  genus: string;
  species: string;
};

export type KeyValue = { label: string; value: string };
export type SubspeciesEntry = { name: string; region: string; note: string };
export type LifecycleStage = { stage: string; detail: string };

export const species = pgTable(
  "species",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    commonName: text("common_name").notNull(),
    nameMr: text("name_mr").notNull().default(""),
    nameHi: text("name_hi").notNull().default(""),
    scientificName: text("scientific_name").notNull(),
    categorySlug: text("category_slug").notNull(),
    subcategorySlug: text("subcategory_slug").notNull().default(""),
    emoji: text("emoji").notNull().default("🐾"),
    summary: text("summary").notNull().default(""),
    wikiTitle: text("wiki_title").notNull().default(""),

    taxonomy: jsonb("taxonomy").$type<TaxonomyRank>().notNull(),
    discovery: text("discovery").notNull().default(""),
    conservation: text("conservation").notNull().default("LC"),
    population: text("population").notNull().default("Not assessed"),

    sizeSummary: text("size_summary").notNull().default(""),
    lengthCm: real("length_cm").notNull().default(0),
    weightKg: real("weight_kg").notNull().default(0),
    physical: jsonb("physical").$type<KeyValue[]>().notNull().default([]),
    colors: text("colors").array().notNull().default([]),

    dietType: text("diet_type").notNull().default("Omnivore"),
    dietItems: text("diet_items").array().notNull().default([]),
    dietNotes: text("diet_notes").notNull().default(""),
    foodChain: text("food_chain").notNull().default(""),

    lifespanWild: real("lifespan_wild").notNull().default(0),
    lifespanCaptive: real("lifespan_captive").notNull().default(0),
    lifespanNotes: text("lifespan_notes").notNull().default(""),

    habitats: text("habitats").array().notNull().default([]),
    continents: text("continents").array().notNull().default([]),
    countries: text("countries").array().notNull().default([]),
    climate: text("climate").notNull().default(""),
    altitude: text("altitude").notNull().default(""),
    migration: text("migration").notNull().default(""),

    reproduction: jsonb("reproduction").$type<KeyValue[]>().notNull().default([]),
    lifecycle: jsonb("lifecycle").$type<LifecycleStage[]>().notNull().default([]),
    behavior: jsonb("behavior").$type<KeyValue[]>().notNull().default([]),
    activity: text("activity").notNull().default("Diurnal"),
    speed: text("speed").notNull().default(""),

    threats: text("threats").array().notNull().default([]),
    conservationNotes: text("conservation_notes").notNull().default(""),
    howToHelp: text("how_to_help").notNull().default(""),

    facts: text("facts").array().notNull().default([]),
    subspecies: jsonb("subspecies").$type<SubspeciesEntry[]>().notNull().default([]),
    relatedSlugs: text("related_slugs").array().notNull().default([]),
    tags: text("tags").array().notNull().default([]),

    popularity: integer("popularity").notNull().default(50),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("species_slug_idx").on(t.slug),
    index("species_category_idx").on(t.categorySlug),
    index("species_subcategory_idx").on(t.subcategorySlug),
    index("species_conservation_idx").on(t.conservation),
  ],
);

/** Community sightings / reviews submitted by visitors */
export const sightings = pgTable(
  "sightings",
  {
    id: serial("id").primaryKey(),
    speciesSlug: text("species_slug").notNull(),
    observer: text("observer").notNull(),
    location: text("location").notNull().default(""),
    note: text("note").notNull().default(""),
    rating: integer("rating").notNull().default(5),
    seen: boolean("seen").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sightings_species_idx").on(t.speciesSlug)],
);

/** Species submitted by the community through the Contribute page */
export const contributions = pgTable("contributions", {
  id: serial("id").primaryKey(),
  commonName: text("common_name").notNull(),
  scientificName: text("scientific_name").notNull().default(""),
  categorySlug: text("category_slug").notNull().default(""),
  region: text("region").notNull().default(""),
  details: text("details").notNull().default(""),
  contributor: text("contributor").notNull().default("Anonymous"),
  email: text("email").notNull().default(""),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Species = typeof species.$inferSelect;
export type NewSpecies = typeof species.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type Subcategory = typeof subcategories.$inferSelect;
export type Sighting = typeof sightings.$inferSelect;
export type Contribution = typeof contributions.$inferSelect;
