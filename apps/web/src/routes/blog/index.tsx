import { createFileRoute, Link } from "@tanstack/react-router";
import { BLOG_POSTS } from "../../data/blogPosts.js";
import { useI18n } from "../../i18n/useI18n.js";

/** Public, like the library — articles are marketing as much as content. */
export const Route = createFileRoute("/blog/")({ component: Blog });

function Blog() {
  const { t, lang } = useI18n();

  return (
    <div className="py-8">
      <h1 className="text-2xl font-semibold text-ink">{t("blog.heading")}</h1>
      {/* Cards, not rows — with the cover image when an article has one. */}
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {BLOG_POSTS.map((post, index) => (
          <li key={post.slug}>
            <Link
              to="/blog/$slug"
              params={{ slug: post.slug }}
              data-testid="blog-card"
              className="group flex h-full flex-col overflow-hidden rounded-card bg-surface shadow-card transition-shadow duration-200 ease-out hover:shadow-card-hover"
            >
              {post.image && (
                // The first card's cover is the page's LCP element: it must
                // load eagerly and with priority, while the below-the-fold
                // covers stay lazy — Lighthouse flagged exactly this split.
                <img
                  src={post.image.src}
                  alt=""
                  width={900}
                  height={600}
                  loading={index === 0 ? "eager" : "lazy"}
                  fetchPriority={index === 0 ? "high" : "auto"}
                  data-testid="blog-card-image"
                  className="aspect-video w-full object-cover"
                />
              )}
              <span className="flex flex-col gap-2 p-6">
                <h2 className="text-lg font-semibold text-ink decoration-accent decoration-2 underline-offset-4 group-hover:underline">
                  {post.title[lang]}
                </h2>
                <p className="text-sm text-muted">{post.excerpt[lang]}</p>
                <time dateTime={post.date} className="text-xs text-muted">
                  {new Date(post.date).toLocaleDateString(lang, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </time>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
