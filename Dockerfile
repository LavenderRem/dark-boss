# ========================================
# 阶段1: 安装依赖
# ========================================
FROM node:20-slim AS deps

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/

RUN pnpm install --frozen-lockfile

# ========================================
# 阶段2: 构建
# ========================================
FROM deps AS build

COPY packages/shared/ packages/shared/
COPY packages/server/ packages/server/
COPY packages/client/ packages/client/

RUN pnpm build

# ========================================
# 阶段3: 生产镜像
# ========================================
FROM node:20-slim AS production

# 安装 claude CLI（Agent 进程模式需要）
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && curl -fsSL https://claude.ai/install.sh | sh \
    && apt-get purge -y curl \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

# 确保 claude 在 PATH 中
ENV PATH="/root/.local/bin:${PATH}"

WORKDIR /app

# 复制生产依赖相关文件
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/

# 安装生产依赖
RUN corepack enable && corepack prepare pnpm@latest --activate \
    && pnpm install --frozen-lockfile --prod

# 复制构建产物
COPY --from=build /app/packages/shared/dist/ packages/shared/dist/
COPY --from=build /app/packages/shared/src/ packages/shared/src/
COPY --from=build /app/packages/server/dist/ packages/server/dist/
COPY --from=build /app/packages/client/dist/ packages/client/dist/

# 创建数据目录
RUN mkdir -p /root/.dark-boss /app/workspace

# 环境变量
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV DATA_DIR=/root/.dark-boss

EXPOSE 3000

CMD ["node", "packages/server/dist/index.js"]
