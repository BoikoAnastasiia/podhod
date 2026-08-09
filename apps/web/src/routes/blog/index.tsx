import { createFileRoute, Link } from "@tanstack/react-router";
import { BLOG_POSTS } from "../../data/blogPosts.js";
import { useI18n } from "../../i18n/useI18n.js";

/** Public, like the library — articles are marketing as much as content. */
export const Route = createFileRoute("/blog/")({ component: Blog });

function Blog() {
  const { t, lang } = useI18n();

  return (
    <div className="mx-auto w-full max-w-content px-4 py-8">
      <h1 className="text-2xl font-semibold text-ink">{t("blog.heading")}</h1>
      <ul className="mt-6 flex flex-col gap-4">
        {BLOG_POSTS.map((post) => (
          <li key={post.slug}>
            <Link
              to="/blog/$slug"
              params={{ slug: post.slug }}
              data-testid="blog-card"
              className="group flex flex-col gap-2 rounded-card bg-surface p-6 shadow-card transition-shadow duration-200 ease-out hover:shadow-card-hover"
            >
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
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
