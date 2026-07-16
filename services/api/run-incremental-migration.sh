echo "🚀 Starting Incremental Migration..."
echo "🔄 The script will automatically detect the last migrated Participant ID and resume from there."

# Run User Migration (auto-detects cursor)
docker exec ybb-api npx ts-node prisma/seeds/internal/migrate-users.ts

echo "✅ Incremental Migration Job Finished."
