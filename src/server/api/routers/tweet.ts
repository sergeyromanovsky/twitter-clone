import { type Prisma } from "@prisma/client";
import { type inferAsyncReturnType } from "@trpc/server";
import { z } from "zod";
import {
  type createTRPCContext,
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";

export const tweetRouter = createTRPCRouter({
  infiniteProfileFeed: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        limit: z.number().optional(),
        cursor: z.object({ id: z.string(), createdAt: z.date() }).optional(),
      })
    )
    .query(async ({ ctx, input: { userId, cursor, limit = 10 } }) => {
      const data = await getInfiniteTweets({
        ctx,
        limit,
        cursor,
        whereClause: { userId },
      });

      return data;
    }),
  infiniteFeed: publicProcedure
    .input(
      z.object({
        onlyFollowing: z.boolean().optional(),
        limit: z.number().optional(),
        cursor: z.object({ id: z.string(), createdAt: z.date() }).optional(),
      })
    )
    .query(
      async ({ input: { cursor, limit = 10, onlyFollowing = false }, ctx }) => {
        const currentUserId = ctx.session?.user.id;

        return await getInfiniteTweets({
          cursor,
          limit,
          ctx,
          whereClause:
            !currentUserId || !onlyFollowing
              ? undefined
              : { user: { followers: { some: { id: currentUserId } } } },
        });
      }
    ),
  create: protectedProcedure
    .input(z.object({ content: z.string() }))
    .mutation(async ({ input: { content }, ctx }) => {
      const tweet = await ctx.prisma.tweet.create({
        data: {
          content,
          userId: ctx.session.user.id,
        },
      });

      void ctx.revalidateSSG?.(`/profiles/${ctx.session.user.id}`);

      return tweet;
    }),
  toggleLike: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input: { id }, ctx }) => {
      const data = { tweetId: id, userId: ctx.session.user.id };

      const existingLike = await ctx.prisma.like.findUnique({
        where: {
          userId_tweetId: data,
        },
      });

      if (existingLike === null) {
        await ctx.prisma.like.create({ data });
        return { addedLike: true };
      } else {
        await ctx.prisma.like.delete({
          where: {
            userId_tweetId: data,
          },
        });
        return { addedLike: false };
      }
    }),
});

interface GetInfiniteTweetsProps {
  whereClause?: Prisma.TweetWhereInput;
  limit: number;
  cursor?: { id: string; createdAt: Date };
  ctx: inferAsyncReturnType<typeof createTRPCContext>;
}

async function getInfiniteTweets({
  whereClause,
  ctx,
  limit,
  cursor,
}: GetInfiniteTweetsProps) {
  const currentUserId = ctx.session?.user.id;

  const data = await ctx.prisma.tweet.findMany({
    cursor: cursor ? { createdAt_id: cursor } : undefined,
    take: limit + 1,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    where: whereClause,
    select: {
      id: true,
      content: true,
      createdAt: true,
      _count: {
        select: {
          likes: true,
        },
      },
      likes: currentUserId
        ? {
            where: {
              userId: currentUserId,
            },
          }
        : false,
      user: {
        select: {
          name: true,
          id: true,
          image: true,
        },
      },
    },
  });

  let nextCursor: typeof cursor | undefined;

  if (data?.length > limit) {
    const nextItem = data.pop();
    if (nextItem) {
      nextCursor = { id: nextItem.id, createdAt: nextItem.createdAt };
    }
  }

  return {
    tweets: data.map((tweet) => ({
      id: tweet.id,
      content: tweet.content,
      createdAt: tweet.createdAt,
      likeCount: tweet._count.likes,
      user: tweet.user,
      likedByMe: tweet.likes?.length > 0,
    })),
    nextCursor,
  };
}
