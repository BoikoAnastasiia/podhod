import { createFileRoute, Link } from "@tanstack/react-router";
import { BLOG_POSTS } from "../../data/blogPosts.js";
import { useI18n } from "../../i18n/useI18n.js";

export const Route = createFileRoute("/blog/$slug")({ component: BlogPost });

function BlogPost() {
  const { slug } = Route.useParams();
  const { t, lang } = useI18n();

  const post = BLOG_POSTS.find((p) => p.slug === slug);

  return (
    <div className="mx-auto w-full max-w-content px-4 py-8">
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
                <a
                  href={post.image.creditUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="link-inline"
                >
                  Unsplash
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
  );
}
