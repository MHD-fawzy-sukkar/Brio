using Brio.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Brio.Data.Configurations;

public class CreatorConfiguration : IEntityTypeConfiguration<Creator>
{
    public void Configure(EntityTypeBuilder<Creator> builder)
    {
        builder.ToTable("Creators");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.GoogleId)
            .IsRequired()
            .HasMaxLength(256);

        builder.HasIndex(c => c.GoogleId)
            .IsUnique();

        builder.Property(c => c.Email)
            .IsRequired()
            .HasMaxLength(256);

        builder.HasIndex(c => c.Email)
            .IsUnique();

        builder.Property(c => c.DisplayName)
            .IsRequired()
            .HasMaxLength(150);

        builder.Property(c => c.CreatedAt)
            .IsRequired();

        builder.HasMany(c => c.Quizzes)
            .WithOne(q => q.Creator)
            .HasForeignKey(q => q.CreatorId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
