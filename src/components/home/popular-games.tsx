"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { GAMES } from "@/lib/games";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function PopularGames() {
  const popular = GAMES.filter((g) => g.popular);

  return (
    <section className="py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Popular <span className="gradient-text">Games</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Access the most popular gaming platforms with instant account setup and premium support.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4 sm:gap-6">
          {popular.map((game, i) => (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="group glass rounded-xl overflow-hidden hover:glow-purple transition-all duration-300"
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                  src={game.image}
                  alt={game.name}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  sizes="(max-width: 640px) 50vw, 33vw"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
                <Badge className="absolute top-3 right-3" variant="default">Popular</Badge>
              </div>
              <div className="p-4">
                <h3 className="font-semibold mb-1">{game.name}</h3>
                <p className="text-xs text-muted-foreground">{game.provider}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="text-center mt-10">
          <Button variant="outline" asChild>
            <Link href="/register">View All Games & Request Account</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
