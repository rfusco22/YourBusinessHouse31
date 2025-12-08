import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { BlogHero } from "@/components/blog-hero"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import { getAllBlogPosts } from "@/lib/blog-data"
import Link from "next/link"

export default function BlogPage() {
  const BLOG_POSTS = getAllBlogPosts()

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <BlogHero />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16" id="blog-posts">
          <div className="mb-8 sm:mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-3 sm:mb-4">Artículos Recientes</h2>
            <p className="text-base sm:text-lg text-muted-foreground">
              Conoce las tendencias y estrategias más recientes en el mercado inmobiliario
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {BLOG_POSTS.map((post, index) => (
              <Card
                key={post.id}
                className="overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col group animate-in fade-in slide-in-from-bottom-4"
                style={{
                  animationDelay: `${index * 100}ms`,
                }}
              >
                {/* Image */}
                <Link href={`/blog/${post.slug}`} className="block">
                  <div className="h-48 sm:h-56 bg-muted overflow-hidden relative">
                    <img
                      src={post.image || "/placeholder.svg"}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </div>
                </Link>

                {/* Content */}
                <div className="p-5 sm:p-6 flex-1 flex flex-col">
                  <div className="mb-3 sm:mb-4">
                    <span className="inline-block bg-primary text-primary-foreground px-2.5 sm:px-3 py-1 rounded-full text-xs font-medium">
                      {post.category}
                    </span>
                  </div>

                  <Link href={`/blog/${post.slug}`}>
                    <h3 className="text-lg sm:text-xl font-bold text-foreground mb-2 sm:mb-3 line-clamp-2 group-hover:text-primary transition-colors cursor-pointer">
                      {post.title}
                    </h3>
                  </Link>
                  <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6 flex-1 line-clamp-3">
                    {post.excerpt}
                  </p>

                  {/* Read More */}
                  <Link href={`/blog/${post.slug}`} className="w-full mt-auto">
                    <Button
                      variant="outline"
                      className="w-full gap-2 text-sm sm:text-base bg-transparent group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all duration-300"
                    >
                      Leer más
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-r from-primary/10 to-secondary/10 py-12 sm:py-16 px-4 sm:px-6 lg:px-8 mt-12 sm:mt-16">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-3 sm:mb-4">
              Suscríbete a Nuestro Newsletter
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground mb-6 sm:mb-8">
              Recibe las últimas actualizaciones y consejos inmobiliarios directamente en tu correo
            </p>
            <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <input
                type="email"
                placeholder="tu@email.com"
                className="flex-1 px-4 py-2.5 sm:py-3 rounded-lg border-2 border-border bg-background focus:outline-none focus:border-primary transition-colors text-sm sm:text-base"
              />
              <Button className="px-6 sm:px-8 text-sm sm:text-base">Suscribirse</Button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
