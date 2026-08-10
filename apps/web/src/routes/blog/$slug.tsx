import { createFileRoute, Link } from "@tanstack/react-router";
import { BLOG_POSTS } from "../../data/blogPosts.js";
import { useI18n } from "../../i18n/useI18n.js";

export const Route = createFileRoute("/blog/$slug")({ component: BlogPost });

function BlogPost() {
  const { slug } = Route.useParams();
  const { t, lang } = useI18n();

  const post = BLOG_POSTS.find((p) => p.slug === slug);
  const others = [...BLOG_POSTS]
    .filter((p) => p.slug !== slug)
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    /*
     * Two columns from lg, MDN-style: the article keeps its reading measure,
     * and the empty right side becomes a rail of the other articles. Below
     * lg the rail stacks under the article, where a sidebar would squeeze
     * the prose.
     */
    <div className="mx-auto flex w-full max-w-content flex-col gap-10 py-8 lg:mx-0 lg:max-w-none lg:flex-row lg:justify-center">
      <div className="w-full lg:max-w-content">
        <Link to="/blog" className="text-sm text-muted underline-offset-4 hover:underline">
          ← {t("blog.heading")}
        </Link>

      {!post ? (
        // A stale or mistyped slug: say so rather than rendering an empty
        // article shell — the list is one click away.
        <p className="mt-6 text-muted">{t("blog.notFound")}</p>
      ) : (
        <article className="mt-6" data-testid="blog-article">
          <h1 className="text-3xl font-bold tracking-tight text-ink">{post.title[lang]}</h1>
          <time dateTime={post.date} className="mt-2 block text-sm text-muted">
            {new Date(post.date).toLocaleDateString(lang, {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </time>
          {post.image && (
            <figure className="mt-6">
              <img
                src={post.image.src}
                alt=""
                width={1200}
                height={675}
                className="aspect-video w-full rounded-card object-cover"
              />
              <figcaption className="mt-2 text-xs text-muted">
                {t("blog.photo")}:{" "}
                <a
                  href={post.image.creditUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="link-inline"
                  data-testid="photo-credit"
                >
                  {post.image.credit} — Unsplash
                </a>
              </figcaption>
            </figure>
          )}
          <div className="mt-6 flex flex-col gap-4">
            {post.paragraphs.map((paragraph, index) => (
              <p key={index} className="leading-relaxed text-ink">
                {paragraph[lang]}
              </p>
            ))}
          </div>
        </article>
      )}
      </div>

      {others.length > 0 && (
        <aside className="w-full shrink-0 lg:sticky lg:top-6 lg:w-64 lg:self-start lg:pt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            {t("blog.more")}
          </h2>
          <ul className="mt-3 flex flex-col gap-3 border-l border-border pl-4">
            {others.map((other) => (
              <li key={other.slug}>
                <Link
                  to="/blog/$slug"
                  params={{ slug: other.slug }}
                  data-testid="more-article"
                  className="text-sm font-medium text-ink decoration-accent decoration-2 underline-offset-4 hover:underline"
                >
                  {other.title[lang]}
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  );
}
