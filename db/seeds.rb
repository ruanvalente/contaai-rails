# This file should ensure the existence of records required to run the application in every environment (production,
# development, test). The code here should be idempotent so that it can be executed at any point in every environment.
# The data can then be loaded with the bin/rails db:seed command (or created alongside the database with db:setup).

puts "Seeding database..."

admin = User.find_or_create_by!(email: "admin@contaai.com") do |user|
  user.name = "Admin"
  user.password = "password123"
  user.password_confirmation = "password123"
  user.role = :reader
  user.confirmed_at = Time.current
end

puts "Created admin user: #{admin.email}"

puts "Seeding complete!"
