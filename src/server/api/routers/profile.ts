import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const profileRouter = createTRPCRouter({
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input: { id } }) => {
      const currentUserId = ctx.session?.user.id;

      const profile = await ctx.prisma.user.findUnique({
        where: { id },
        select: {
          name: true,
          _count: { select: { followers: true, follows: true, tweets: true } },
          image: true,
          followers: !currentUserId
            ? undefined
            : {
                where: { id: currentUserId },
              },
        },
      });

      if (!profile) return;

      return {
        name: profile.name,
        image: profile.image,
        followersCount: profile._count.followers,
        followsCount: profile._count.follows,
        tweetsCount: profile._count.tweets,
        isFollowing: profile.followers?.length > 0,
      };
    }),
});
