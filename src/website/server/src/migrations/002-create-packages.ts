import { QueryInterface, DataTypes } from "sequelize";

export async function up(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.createTable("packages", {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        scope: { type: DataTypes.STRING(100), allowNull: true },
        name: { type: DataTypes.STRING(214), allowNull: false },
        full_name: { type: DataTypes.STRING(320), allowNull: false },
        display_name: { type: DataTypes.STRING(255), allowNull: true },
        description: { type: DataTypes.TEXT, allowNull: true },
        readme_text: { type: DataTypes.TEXT, allowNull: true },
        license: { type: DataTypes.STRING(100), allowNull: true },
        owner_user_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: "users", key: "id" } },
        owner_organization_id: { type: DataTypes.INTEGER, allowNull: true },
        visibility: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "public" },
        status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "active" },
        verification_status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "unverified" },
        repo_full_name: { type: DataTypes.STRING(255), allowNull: true },
        github_repo_id: { type: DataTypes.BIGINT, allowNull: true },
        repository_url: { type: DataTypes.STRING(1024), allowNull: true },
        homepage_url: { type: DataTypes.STRING(1024), allowNull: true },
        documentation_url: { type: DataTypes.STRING(1024), allowNull: true },
        latest_version_id: { type: DataTypes.INTEGER, allowNull: true },
        latest_version: { type: DataTypes.STRING(50), allowNull: true },
        total_downloads: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
        weekly_downloads: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
        versions_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        dependencies_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        dependents_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        last_published_at: { type: DataTypes.DATE, allowNull: true },
        last_checked_at: { type: DataTypes.DATE, allowNull: true },
      keywords: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      maintainers: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
        security: { type: DataTypes.JSONB, allowNull: true },
        download_trend: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
        created_at: { type: DataTypes.DATE, allowNull: false },
        updated_at: { type: DataTypes.DATE, allowNull: false },
    });

    await queryInterface.addIndex("packages", ["full_name"], { unique: true });
    await queryInterface.addIndex("packages", ["scope", "name"], { unique: true });
    await queryInterface.addIndex("packages", ["status"]);
    await queryInterface.addIndex("packages", ["weekly_downloads"]);
    await queryInterface.addIndex("packages", ["total_downloads"]);
    await queryInterface.addIndex("packages", ["last_published_at"]);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.dropTable("packages");
}
